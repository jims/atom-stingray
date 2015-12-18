/** @babel */

import fs from 'fs';
import {MurmurHash} from './murmurhash';
import * as Rx from 'rx';

var zeroes = ["", "0", "00", "000", "0000"];

export class IdString {
    static parse(buffer) {
        var lookup = {};
        var start = 0;
        while (start < buffer.length) {
            var end = start;
            while (end < buffer.length && buffer[end] != 0)
                ++end;
                
            var s = buffer.toString("utf8", start, end);
            var h = MurmurHash.hash64(buffer.slice(start, end));
            
            var a00 = h._a00.toString(16);
            a00 = zeroes[4-a00.length] + a00;
            
            var a16 = h._a16.toString(16);
            a16 = zeroes[4-a16.length] + a16;
            
            var a32 = h._a32.toString(16);
            a32 = zeroes[4-a32.length] + a32;
            
            var a48 = h._a48.toString(16);
            a48 = zeroes[4-a48.length] + a48;
                
            var loStr = a16 + a00;
            var hiStr = a48 + a32;
            
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
