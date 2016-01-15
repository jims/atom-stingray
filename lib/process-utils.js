/** @babel */

import * as ChildProcess from "child_process";
import {Observable} from "rx";

export const exec = Observable.fromNodeCallback(ChildProcess.exec);
const parseCSVLine = line => line.substr(1, line.length - 2).split('","');

export function runningTasks() {
    // TODO: Implement for non-Windows platforms.
    return exec('tasklist /FO CSV /NH')
        .map(([stdout, stderr]) => stdout.trim().split(/\r?\n/).map(parseCSVLine)
            .map(cols => ({name: cols[0], pid: parseInt(cols[1], 10)})));
}
