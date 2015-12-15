/** @babel */

import * as Toolchain from "./stingray/toolchain";
import * as AssetServer from "./stingray/asset-server";
import * as Project from "./stingray/project";
import {LogConsole, LogEntry} from "./log-console";
import * as ConsoleConnection from "./stingray/console-connection";
import {CompositeDisposable, Disposable} from "atom"
import * as Rx from 'rx';
import path from 'path';
import fs from 'fs';

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
        this.disposables = new CompositeDisposable();
        this.disposables.add(this.logConsole);

        this.disposables.add(atom.commands.add("atom-workspace", "stingray:refresh", this.refresh.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:toggle-console", this.toggleConsole.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:run-project", this.runProject.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:compile", this.compile.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:execute-buffer", this.executeBuffer.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:execute-selection", this.executeSelection.bind(this)));
        this.disposables.add(atom.commands.add("atom-workspace", "stingray:open-resource", this.openResource.bind(this)));

        this.toolChainConfiguration = Toolchain.runningToolchainPath()
            .flatMap(Toolchain.configuration);

        this.disposables.add(this.toolChainConfiguration
            .map(Toolchain.runtimeExecutable)
            .subscribe(AssetServer.ensureRunning));
            
        this.logConsole.addEntry(new LogEntry("info", "Stingray package loaded"));
        
        this.localPorts = ConsoleConnection.observableOfOpenPorts(14000, 14030)
            .filter(x => x.status === "opened")
            .map(x => x.port);
            
        const consoleSubscription = this.localPorts
            .map(x => `ws://localhost:${x}`)
            .merge(this.toolChainConfiguration
                .flatMap(Toolchain.targets)
                .flatMap(x => ConsoleConnection.isPortOpen(x, x.host, x.port))
                .map(target => `ws://${target.host}:${target.port}`))
            .flatMap(ConsoleConnection.create)
            .filter(x => x.type === "message")
            .subscribe(x => this.logConsole.addEntry(new LogEntry(x.level, x.message)));
            
        this.disposables.add(consoleSubscription);
    }

    projects() {
        let config = Toolchain.runningToolchainPath()
            .concatMap(Toolchain.configuration);
        let projectRoots = Rx.Observable.from(atom.project.rootDirectories)
            .map(x => x.path)
            .filter(Project.isProjectDirectory);
        return projectRoots.zip(config)
            .map(x => Project.settings(x[0], x[1]))
    }

    doCompile() {
        var result = new Rx.Subject();
        this.projects().concatMap(AssetServer.compile).subscribe(
            x => {atom.notifications.addSuccess("Compiled"); result.onNext(x);},
            error => {atom.notifications.addError(AssetServer.formatCompileErrors(error),
                {dismissable: true}); result.onError(error);},
            result.onCompleted.bind(result)
        );
        return result;
    }

    runProject(event) {
        this.doCompile().subscribe(Project.runProject);
    }

    compile(event) {
        this.doCompile();
    }

    toggleConsole(event) {
        this.logConsole.visible = !this.logConsole.visible;
    }

    refresh(event) {
        this.doCompile().subscribe(_ => {
            this.localPorts
                .map(x => 'ws://localhost:' + x)
                .subscribe(x => ConsoleConnection.send(x, ConsoleConnection.encodeCommand("refresh")));
        });
    }

    executeBuffer(event) {
        var text = atom.workspace.getActiveTextEditor().getText();
        this.localPorts
            .map(x => 'ws://localhost:' + x)
            .subscribe(x => ConsoleConnection.send(x, ConsoleConnection.encodeLua(text)));
    }

    executeSelection(event) {
        var text = atom.workspace.getActiveTextEditor().getSelectedText();
        this.localPorts
            .map(x => 'ws://localhost:' + x)
            .subscribe(x => ConsoleConnection.send(x, ConsoleConnection.encodeLua(text)));
    }

    openResource(event) {
        var te = atom.workspace.getActiveTextEditor();
        var sel = te.getSelectedBufferRange();
        var start = sel.start.column;
        var end = sel.end.row == sel.start.row ? sel.end.column : sel.start.column;
        var line = te.lineTextForBufferRow(sel.start.row);

        while (start > 0) {
            var s = line.substr(start-1,1)
            if (s === "\"" || s === "`" || s === "'")
                break;
            start--;
        }
        while (end < line.length) {
            var s = line.substr(end,1);
            if (s === "\"" || s === "`" || s === "'")
                break;
            end++;
        }
        var resource = line.substr(start, end-start);
        var dir = path.dirname(resource);
        var base = path.basename(resource);

        var roots = Rx.Observable.from(atom.project.rootDirectories);
        var mathces = roots
            .map(root => root.path)
            .concatMap(root =>
                {
                    var absDir = path.join(root, dir);
                    if (!fs.existsSync(absDir))
                        return Rx.Observable.from([]);
                    else
                        return Rx.Observable.from(fs.readdirSync(absDir))
                            .filter(x => x.startsWith(base))
                            .map(x => path.join(absDir, x))
                }
            ).toArray()
            .subscribe(arr => {
                if (arr.length == 0)
                    atom.notifications.addError("Resource not found: ``" + resource + "`");
                arr.forEach(a => atom.workspace.open(a))
            });
    }

    dispose() {
        this.logConsole.addEntry(new LogEntry("info", "Stingray package unloaded"));
        this.disposables.dispose();
    }

    serialize() {
        return {
            logConsole: this.logConsole.serialize()
        }
    }

    consumeStatusBar(statusBar) {
        // Add our element to the status bar.
        const element = document.createElement("button");
        element.innerText = "My Button";
        let tile = statusBar.addRightTile({item: element, priority: 100});

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
