/** @babel */

import fs from 'fs'
import { SJSON } from './sjson'

export default class {
    static getProjects(toolchain) {
        console.log(SJSON.parse);
        return fs.readdirSync(toolchain);
    }
}
