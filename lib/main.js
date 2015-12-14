/** @babel */

import * as toolchain from "./stingray/toolchain";
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
        this.disposables = new CompositeDisposable();
        this.disposables.add(
            atom.commands.add("atom-workspace", "stingray:refresh", event => {
                toolchain.runningToolchainPath()
                    .do(x => console.log(x))
                    .subscribe(toolchain => this.toolchain = toolchain);
            }));
    }

    consumeStatusBar(statusBar) {
        const element = document.createElement("button");
        element.innerText = "My Button";
        let tile = statusBar.addRightTile({item: element, priority: 100});

        const disposeStatusBar = new Disposable(() => {
            if (tile)
                tile.destroy();

            tile = null;
        });

        this.disposables.add(disposeStatusBar);
        return disposeStatusBar;
    }

    dispose() {
        this.disposables.dispose();
    }
}

let packageInstance = null;

export function activate(state) {
    packageInstance = new StingrayPackage();
}

export function consumeStatusBar(statusBar) {
    return packageInstance.consumeStatusBar(statusBar);
}

export function deactivate() {
    packageInstance.dispose();
}
