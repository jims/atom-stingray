/** @babel */
export default {
    activate: state => {
        Project = require('./project');
        
        console.log(state);
        
        atom.commands.add('atom-workspace',
            'stingray:refresh',
            event => {
                console.log(Project.getProjects("d:/toolchain/stingray"));
            });
    },
    
    deactivate: () => {}
}
