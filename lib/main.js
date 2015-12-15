/** @babel */

import * as Toolchain from "./stingray/toolchain";
import * as AssetServer from "./stingray/asset-server";
import * as Project from "./stingray/project";
import {LogConsole, LogEntry} from "./log-console";
import {CompositeDisposable, Disposable} from "atom"

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

        Toolchain.runningToolchainPath()
            .concatMap(Toolchain.configuration)
            .map(Toolchain.runtimeExecutable)
            .subscribe(AssetServer.ensureRunning);
    }
    
    runProject(event) {
        Toolchain.runningToolchainPath()
            .concatMap(Toolchain.configuration)
            .subscribe(config => {
            atom.project.rootDirectories
                .map(x => x.path)
                .filter(x => Project.isProjectDirectory)
                .forEach(x => {
                    const settings = {
                        executable: Toolchain.runtimeExecutable(config),
                        sourceDir: x,
                        dataDir: Project.windowsDataDirectory(x),
                        coreParent: Toolchain.sourceRepositoryPath(config)
                    };
                    Project.runProject(settings);
                });
        });
    }
    
    toggleConsole(event) {
        this.logConsole.visible = !this.logConsole.visible;
    }
    
    refresh(event) {
        Toolchain.runningToolchainPath()
            .concatMap(Toolchain.configuration)
            .concatMap(Toolchain.projects)
            .subscribe(x => console.log(x));
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
