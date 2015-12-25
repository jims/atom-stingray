/** @babel */

import * as Toolchain from "./stingray/toolchain";
import * as AssetServer from "./stingray/asset-server";
import * as Project from "./stingray/project";
import {IdString} from "./stingray/idstring";
import {assetServerPort} from "./reserved-ports";
import {LogConsole, LogEntry} from "./log-console";
import {ProgressIndicator} from "./progress-indicator";
import * as ConsoleConnection from "./stingray/console-connection";
import {CompositeDisposable, Disposable} from "atom"
import * as Rx from 'rx';
import path from 'path';
import fs from 'fs';
import * as Help from "./stingray/help"
import url from 'url';
import {adoc} from "./stingray/adoc";
import * as AutoComplete from "./stingray/autocomplete";

const readFile = Rx.Observable.fromNodeCallback(fs.readFile);

function watchFile(path) {
    return Rx.Observable.create(observer => {
        const watcher = fs.watch(path, (event, _) => {
            if (event === "change")
                observer.onNext(path);
        });

        // Initial pass-through
        observer.onNext(path);

        return () => watcher.close();
    });
}

export const config = {
    toolchainPath: {
        type: 'string',
        default: process.env.SR_BIN_DIR || '',
        description: 'The path to the stingray toolchain directory that should be used.'
    }
};

class StingrayPackage {
    constructor(state) {
        this.logConsole = new LogConsole(state.logConsole || {});
        this.progressIndicator = new ProgressIndicator();

        this.disposables = new CompositeDisposable();
        this.disposables.add(this.logConsole);
        this.disposables.add(this.progressIndicator);

        this.disposables.add(atom.commands.add("atom-workspace", "stingray:refresh", this.refresh.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:toggle-console", this.toggleConsole.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:run-project", this.runProject.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:compile", this.compile.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:execute-buffer", this.executeBuffer.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:execute-selection", this.executeSelection.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:open-resource", this.openResource.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:help", this.help.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:help-selection", this.helpSelection.bind(this)));

        this.toolChainConfiguration = Toolchain.runningToolchainPath()
            .flatMap(Toolchain.configuration);

        // TODO: Just look at the first project for now. This will break if we've got files from multiple projects open.
        const idStringSubscription = this.projects()
            .first()
            .map(project => path.join(project.dataDir, "strings.txt"))
            .flatMap(watchFile)
            .do(x => console.log("(Re)-loading " + x))
            .flatMap(x => readFile(x))
            .map(IdString.parse)
            .subscribe(lookup => this.logConsole.idStringLookup = lookup);

        const localPorts = ConsoleConnection.observableOfOpenPorts(assetServerPort)
            .merge(ConsoleConnection.observableOfOpenPorts(14000, 14030))
            .filter(x => x.status === "opened")
            .map(x => x.port);

        const consoleSubscription = localPorts
            .map(x => ({host: "127.0.0.1", port: x}))
            .merge(this.toolChainConfiguration
                .flatMap(Toolchain.targets)
                .flatMap(x => ConsoleConnection.isPortOpen(x, x.host, x.port)))
            .subscribe(x => this.logConsole.handleEngineDetected(x.host, x.port,
                ConsoleConnection.create(`ws://${x.host}:${x.port}`)));

        this.disposables.add(idStringSubscription);
        this.disposables.add(consoleSubscription);
        this.disposables.add(localPorts);
        this.disposables.add(atom.workspace.addOpener(this.opener.bind(this)));

        Toolchain.runningToolchainPath().flatMap(adoc)
          .subscribe((x) => {Help.setAdoc(x); AutoComplete.setAdoc(x);});
    }

    projects() {
        let projectRoots = Rx.Observable.from(atom.project.rootDirectories)
            .map(x => x.path)
            .filter(Project.isProjectDirectory);
        return projectRoots.zip(this.toolChainConfiguration)
            .map(x => Project.settings(x[0], x[1]))
    }

    doCompile() {
        return Rx.Observable.create(observer => {
            let files = [];
            let project = null;
            this.progressIndicator.active = true;
            this.progressIndicator.progress = 0.0;
            const subscription = this.projects()
                .concatMap(AssetServer.compile)
                .subscribe(
                    event => {
                        if (event.type === "files")
                            files = event.files;
                        else if (event.type === "project")
                            project = event.project;
                        else if (event.type === "progress")
                            this.progressIndicator.progress = event.progress / event.total;
                    }, errors => {
                        if (errors instanceof Array)
                            errors.map(AssetServer.formatCompileError).forEach(e => atom.notifications.addError(e, {dismissable:true}));
                        else
                            atom.notifications.addError("Unknown compile error.");
                    }, () => {
                        this.progressIndicator.active = false;
                        atom.notifications.addSuccess(`Compiled ${files.length} files.`);
                        observer.onNext(project);
                        observer.onCompleted();
                        subscription.dispose();
                    });

            return () => subscription.dispose();
        });
    }

    reportCompileProgress(progress) {
        console.log(progress);
    }

    runProject(event) {
        this.doCompile().subscribe(Project.runProject);
    }

    compile(event) {
        this.doCompile().subscribe();
    }

    toggleConsole(event) {
        this.logConsole.visible = !this.logConsole.visible;
    }

    refresh(event) {
        const tab = this.logConsole.activeTab;
        if (tab != null)
            this.doCompile().subscribe(_ => tab.socketObservable.onNext(ConsoleConnection.encodeCommand("refresh")));
    }

    executeBuffer(event) {
        const text = atom.workspace.getActiveTextEditor().getText();
        const tab = this.logConsole.activeTab;

        if (tab != null)
            tab.socketObservable.onNext(ConsoleConnection.encodeLua(text));
    }

    executeSelection(event) {
        var text = atom.workspace.getActiveTextEditor().getSelectedText();
        const tab = this.logConsole.activeTab;

        if (tab != null)
            tab.socketObservable.onNext(ConsoleConnection.encodeLua(text));
    }

    expandedSelection(f) {
        var te = atom.workspace.getActiveTextEditor();
        var sel = te.getSelectedBufferRange();
        var row = sel.start.row;
        var start = sel.start.column;
        var end = sel.end.row == row ? sel.end.column : sel.start.column;
        var line = te.lineTextForBufferRow(row);

        while (start > 0) {
            var s = line.substr(start-1, end-start+1)
            if (!f(s))
                break;
            start--;
        }
        while (end < line.length) {
            var s = line.substr(start, end-start+1);
            if (!f(s))
                break;
            end++;
        }
        return line.substr(start, end-start);
    }

    openResource(event) {
        var resource = this.expandedSelection(s => s.match(/^[^'"`]*$/))
        var dir = path.dirname(resource);
        var base = path.basename(resource);

        let arr = atom.project.rootDirectories
            .map(root => root.path)
            .map(root => {
                    var absDir = path.join(root, dir);
                    if (!fs.existsSync(absDir))
                        return []
                    else
                        return fs.readdirSync(absDir)
                            .filter(x => x.startsWith(base))
                            .map(x => path.join(absDir, x))
                })
            .reduce((a,b) => a.concat(b), [])

        if (arr.length == 0)
            atom.notifications.addError(`Resource not found: \`${resource}\`.`);
        arr.forEach(a => atom.workspace.open(a))
    }

    help(event) {
      Help.showHelpList();
    }

    helpSelection(event) {
        var s = this.expandedSelection(s => s.match(/^[a-zA-Z._0-9]*$/));
        if (s === "")
            return;
        else if (Help.has(s))
            atom.workspace.open(`stingray-help://help/${s}`, {split: "right"});
        else
            atom.notifications.addError(`\`${s}\` not found in Lua API.`)

    }

    opener(uri) {
      var o = url.parse(uri);
      if (o.protocol === "stingray-help:") {
        return Help.createHelpView(o.pathname.substr(1));
      }
    }

    dispose() {
        this.disposables.dispose();
    }

    serialize() {
        return {
            logConsole: this.logConsole.serialize()
        }
    }

    consumeStatusBar(statusBar) {
        // Add our element to the status bar.
        let tile = statusBar.addRightTile({item: this.progressIndicator.element, priority: -Infinity});

        // Create a Disposable that will remove our element from the status bar.
        // This Disposable is also returned from this function, and it will be
        // called in case the status bar module is unloaded.
        const disposeStatusBar = new Disposable(() => {
            if (tile)
                tile.destroy();

            tile = null;
        });

        this.disposables.add(disposeStatusBar);
        return disposeStatusBar;
    }
}

let packageInstance = null;

export function activate(state) {
    packageInstance = new StingrayPackage(state);
}

export function deactivate() {
    packageInstance.dispose();
}

export function serialize() {
    return packageInstance.serialize();
}

export function consumeStatusBar(statusBar) {
    return packageInstance.consumeStatusBar(statusBar);
}

export function provide() {
    const provider =  AutoComplete.adocProvider;
    console.log(provider);
    return provider;
}
