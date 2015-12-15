/** @babel */

import * as child_process from 'child_process';
import path from 'path';
import * as Toolchain from "./toolchain";
import fs from 'fs';

export function isProjectDirectory(dir) {
    return fs.existsSync(path.join(dir, 'settings.ini'))
}

export function windowsDataDirectory(dir) {
    return path.join(dir + "_data", "win32");
}

export function settings(dir, config)
{
    return {
        executable: Toolchain.runtimeExecutable(config),
        sourceDir: dir,
        dataDir: windowsDataDirectory(dir),
        coreRoot: Toolchain.sourceRepositoryPath(config)
    };
}

export function runProject(o) {
    child_process.spawn(o.executable, ["--data-dir", o.dataDir]);
}
