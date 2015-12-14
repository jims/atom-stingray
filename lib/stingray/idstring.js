/** @babel */

import fs from 'fs';

export class IdString {
    static hash64(buffer) {
        // Need to write this without using 64 bit numbers
    }

    static parse(path) {
        let buffer = fs.readFileSync(path);
        let start = 0;
        while (start < buffer.length) {
            let end = start;
            while (end < buffer.length && buffer[end] != 0)
                ++end;
            let s = buffer.toString("utf8", start, end);
            console.log(s);
            start = end + 1;
        }
    }

    static test() {
        parse("D:\\BigWork\\projects\\testbed_data\\win32\\strings.txt")
    }
};
