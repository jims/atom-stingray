/** @babel */

export class Project {    
    constructor(p) {
        this.project = p;
    }
    
    get name() {
        return this.project.Name;
    }
    
    get path() {
        return this.project.SourceDirectory;
    }
    
    toString() {
        return `Project(name: ${this.name})`;
    }
};
