/** @babel */

import * as stingray from './stingray';

export const config = {
    toolchainPath: {
        type: 'string',
        default: process.env.SR_BIN_DIR || '',
        description: 'The path to the stingray toolchain directory that should be used.'
    }
};

export default {
    activate: state => {        
        console.log(stingray.Toolchain.currentToolchain);
        atom.commands.add('atom-workspace',
            'stingray:refresh',
            event => {
                console.log(Project.getProjects("d:/toolchain/stingray"));
            });
    },
    
    deactivate: () => {}
};
