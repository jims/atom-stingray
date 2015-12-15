/** @babel */

import * as Toolchain from "./stingray/toolchain";
import * as AssetServer from "./stingray/asset-server";
import * as Project from "./stingray/project";
import {LogConsole, LogEntry} from "./log-console";
import * as ConsoleConnection from "./stingray/console-connection";
import {CompositeDisposable, Disposable} from "atom"
import * as Rx from 'rx';

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

        this.disposables.add(Toolchain.runningToolchainPath()
            .concatMap(Toolchain.configuration)
            .map(Toolchain.runtimeExecutable)
            .subscribe(AssetServer.ensureRunning));

        this.logConsole.addEntry(new LogEntry("info", "Stingray package loaded"));

        let ports = []
        ConsoleConnection.observableOfOpenPorts(14000, 14030).subscribe(
            x => {
                if (x.status == "opened")
                    ports.push(x.port);
                else
                    ports.splice(ports.indexOf(x.port),1);
            }
        );
        this.ports = ports;
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
        this.doCompile().subscribe(x => {
            Rx.Observable.from(this.ports)
                .map(x => 'ws://localhost:' + x)
                .subscribe(x => ConsoleConnection.send(x, ConsoleConnection.encodeCommand("refresh")));
        });
    }

    executeBuffer(event) {
        var text = atom.workspace.getActiveTextEditor().getText();
        Rx.Observable.from(this.ports)
            .map(x => 'ws://localhost:' + x)
            .subscribe(x => ConsoleConnection.send(x, ConsoleConnection.encodeLua(text)));
    }

    executeSelection(event) {
        var text = atom.workspace.getActiveTextEditor().getSelectedText();
        Rx.Observable.from(this.ports)
            .map(x => 'ws://localhost:' + x)
            .subscribe(x => ConsoleConnection.send(x, ConsoleConnection.encodeLua(text)));
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
