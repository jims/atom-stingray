/** @babel */

import fs from 'fs';
import {MurmurHash} from './murmurhash';

const zeroes = [
        "",
        "0",
        "00",
        "000",
        "0000",
        "00000",
        "000000",
        "0000000",
        "00000000",
        "000000000",
        "0000000000",
        "00000000000",
        "000000000000",
        "0000000000000",
        "00000000000000",
        "000000000000000",
];

export class IdString {
    static hashToString64(h) {
        var s = h.toString(16);
        return zeroes[16-s.length] + s;
    }

    static hashToString32(h) {
        var s = h.clone().shiftRight(32).toString(16);
        return zeroes[8-s.length] + s;
    }

    static parse(path) {
        let lookup = {};
        let buffer = fs.readFileSync(path);
        let start = 0;
        while (start < buffer.length) {
            let end = start;
            while (end < buffer.length && buffer[end] != 0)
                ++end;
            let s = buffer.toString("utf8", start, end);
            let h = MurmurHash.hash64(buffer.slice(start, end));
            lookup[IdString.hashToString64(h)] = s;
            lookup[IdString.hashToString32(h)] = s;
            start = end + 1;
        }
        return lookup;
    }

    static test() {
        let lookup = IdString.parse("D:\\BigWork\\projects\\testbed_data\\win32\\strings.txt")
        console.assert(lookup["e0a48d0be9a7453f"] == "unit");
        console.assert(lookup["bccf91e5"] == "root");
    }
};
