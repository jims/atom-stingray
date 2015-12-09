/** @babel */

import fs from 'fs';
import {Buffer} from 'buffer';
import {SJSON} from './sjson';

export class Project {
    static getProjects(toolchain) {
        const s = Buffer('{ test = [1 2 23 4] var = {"awesome": 2 lol = 3 }}');
        console.log(SJSON.parse(s));
        return fs.readdirSync(toolchain);
    }
};
