/** @babel */

import * as child_process from 'child_process';
import path from 'path';

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

    static isProjectDirectory(dir) {
        return fs.existsSync(path.join(dir, 'settings.ini'))
    }

    static windowsDataDirectory(dir) {
        return path.join(dir + "_data", "win32");
    }

    static runProject(o) {
        const args =  [
            "--source-dir", o.sourceDir,
            "--data-dir", o.dataDir,
            "--map-source-dir", "core", o.coreParent,
            "--compile",
            "--continue"
        ]
        child_process.spawn(o.executable, args);
    }
};
