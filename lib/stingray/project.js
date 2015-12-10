/** @babel */

import fs from 'fs';
import path from 'path';
import {Buffer} from 'buffer';
import {SJSON} from './sjson';

export class Project {
    static getProjects(toolchain) {
        const json = fs.readFileSync(path.join(toolchain, "settings", "ToolChainConfiguration.config"));
        const config = SJSON.parse(json);
        return config.Projects.map(p => new Project(p));
    }
    
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
