/** @babel */

import * as stingray from './stingray';

export const config = {
    toolchainPath: {
        type: 'string',
        default: process.env.SR_BIN_DIR || '',
        description: 'The path to the stingray toolchain directory that should be used.'
    }
};

export function activate(state) {
    atom.commands.add('atom-workspace',
        'stingray:refresh',
        event => {
            stingray.Toolchain.runningToolchainPath
                .subscribe(p => console.log(p));
        });

    // stingray.IdString.test();
    stingray.UInt64.test();
}

export function deactivate() {

}
