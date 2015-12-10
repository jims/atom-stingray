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
            const projects = stingray.Project.getProjects(stingray.Toolchain.currentToolchain);
            for (let p of projects)
                console.log(p);
        });
}
    
export function deactivate() {
        
}
