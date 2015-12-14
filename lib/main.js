/** @babel */

import * as toolchain from "./stingray/toolchain";
import {AssetServer} from "./stingray/asset-server";

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
        this.consolePanel = null;
        this.disposables = new CompositeDisposable();

        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:refresh", event => {
                toolchain.runningToolchainPath()
                    .concatMap(toolchain.projects)
                    .subscribe(x => console.log(x));
            }));

        toolchain.runningToolchainPath().map(toolchain.assetServerExecutable)
            .subscribe(exe => AssetServer.ensureRunning(exe));

        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:toggleConsole", event => {
                this.consoleVisible = !this.consoleVisible;
            }));

        this.consoleVisible = state.consoleVisible == true;
    }

    dispose() {
        if (this.consolePanel)
            this.consolePanel.destroy();

        this.disposables.dispose();
    }

    serialize() {
        return {
            consoleVisible: this.consoleVisible
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

    get consoleVisible() {
        return this.consolePanel != null;
    }

    set consoleVisible(visible) {
        if (this.consoleVisible == visible)
            return;

        if (visible) {
            console.assert(this.consolePanel == null);
            var element = document.createElement("button");
            element.innerText = "Stingray Console Panel";
            this.consolePanel = atom.workspace.addBottomPanel({
                item: element,
                visible: true,
                priority: 1
            });
        } else {
            this.consolePanel.destroy();
            this.consolePanel = null;
        }
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
