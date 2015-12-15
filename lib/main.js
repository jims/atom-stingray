/** @babel */

import * as toolchain from "./stingray/toolchain";
import {AssetServer} from "./stingray/asset-server";
import {Project} from "./stingray/project";
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

        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:refresh", event => {
                const config = toolchain.runningToolchainPath()
                    .concatMap(toolchain.configuration);

                config.concatMap(toolchain.projects)
                    .subscribe(x => console.log(x));

                config.map(toolchain.sourceRepositoryPath)
                    .subscribe(x => console.log(x));
            }));

        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:toggleConsole", event => {
                this.logConsole.visible = !this.logConsole.visible;
            }));

        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:runProject", event => {
                toolchain.runningToolchainPath().subscribe(binDir => {
                    atom.project.rootDirectories
                        .map(x => x.path)
                        .filter(x => Project.isProjectDirectory)
                        .forEach(x => {
                            const settings = {
                                executable: toolchain.runtimeExecutable(binDir),
                                sourceDir: x,
                                dataDir: Project.windowsDataDirectory(x),
                                coreRoot: binDir
                            };
                            Project.runProject(settings);
                        });
                });
            }));

        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:compile", event => {
                toolchain.runningToolchainPath().subscribe(binDir => {
                    atom.project.rootDirectories
                        .map(x => x.path)
                        .filter(x => Project.isProjectDirectory)
                        .forEach(x => {
                            const settings = {
                                executable: toolchain.runtimeExecutable(binDir),
                                sourceDir: x,
                                dataDir: Project.windowsDataDirectory(x),
                                coreRoot: binDir
                            };
                            AssetServer.compile(settings);
                        });
                });
            }));

        toolchain.runningToolchainPath().map(toolchain.runtimeExecutable)
            .subscribe(exe => AssetServer.ensureRunning(exe));
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
