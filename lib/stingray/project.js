/** @babel */

import * as child_process from 'child_process';
import path from 'path';

export function isProjectDirectory(dir) {
    return fs.existsSync(path.join(dir, 'settings.ini'))
}

export function windowsDataDirectory(dir) {
    return path.join(dir + "_data", "win32");
}

export function runProject(o) {
    const args =  [
        "--source-dir", o.sourceDir,
        "--data-dir", o.dataDir,
        "--map-source-dir", "core", o.coreParent,
        "--compile",
        "--continue"
    ]
    child_process.spawn(o.executable, args);
}
