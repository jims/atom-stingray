/** @babel */

import fs from 'fs';
import {MurmurHash} from './murmurhash';
import * as Rx from 'rx';

var zeroes = [
    "",
    "00000000",
    "0000000",
    "000000",
    "00000",
    "0000",
    "000",
    "0",
    ""
];

export class IdString {
    static parse(buffer) {
        var lookup = {};
        var start = 0;
        while (start < buffer.length) {
            var end = start;
            while (end < buffer.length && buffer[end] != 0)
                ++end;

            var bytes = buffer.slice(start, end);
            var s = bytes.toString();
            var h = MurmurHash.hash64(bytes);

            var hiStr = (h[0] >>> 0).toString(16);
            hiStr = zeroes[hiStr.length] + hiStr;

            var loStr = (h[1] >>> 0).toString(16);
            loStr = zeroes[loStr.length] + loStr;

            lookup[hiStr] = s;
            lookup[hiStr + loStr] = s;
            start = end + 1;
        }
        return lookup;
    }

    static replaceIdStringTagsWithStrings(lookup, text) {
        return text.replace(/#ID\[([0-9a-f]+)\]/mg, (match, p1) => lookup[p1] || match);
    }

    static test() {
        let buffer = fs.readFileSync(String.raw`d:\projects\autodesk\stingray-testbed_data\win32\strings.txt`);
        let lookup = IdString.parse(buffer);
        console.assert(lookup["e0a48d0be9a7453f"] == "unit");
        console.assert(lookup["bccf91e5"] == "root");
    }
};
