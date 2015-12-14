/** @babel */

import {UINT64} from 'cuint';

export class MurmurHash {
    static hash64(key) {
        var seed = UINT64(0,0);
        const m = UINT64(0x5bd1e995, 0xc6a4a793);
        const r = 47;
        let h = seed.clone().xor(UINT64(key.length, 0).multiply(m));
        let i = 0;
        for (; i+8 <= key.length; i += 8) {
            let k = UINT64(key.readUInt32LE(i), key.readUInt32LE(i+4));
            k.multiply(m);
            k.xor(k.clone().shiftRight(r));
            k.multiply(m);

            h.xor(k);
            h.multiply(m);
        }

        const remaining = key.length - i;
        for (let j=remaining-1; j>=0; --j) {
            h.xor(UINT64(key[i+j], 0).shiftLeft(8*j));
        }
        h.multiply(m);

        h.xor(h.clone().shiftRight(r));
        h.multiply(m);
        h.xor(h.clone().shiftRight(r));

        return h;
    }

    static test() {
        let zero = UINT64(0x00000000, 0x00000000);
        let a = UINT64(0xa0000000, 0xa0000000);
        console.assert(zero.toString(16) == "0");
        console.assert(a.toString(16) == "a0000000a0000000");

        console.assert(a.clone().xor(zero).toString() == a.toString());
        console.assert(a.clone().xor(a).toString() == zero.toString());

        console.assert(MurmurHash.hash64(new Buffer("")).toString(16) == "0");
        console.assert(MurmurHash.hash64(new Buffer("a")).toString(16) == "71717d2d36b6b11");
        console.assert(MurmurHash.hash64(new Buffer("unit")).toString(16) == "e0a48d0be9a7453f");
        console.assert(MurmurHash.hash64(new Buffer("core/shader_nodes/square_root.win32.shader_node")).toString(16) == "95a852f042a1f7d2");
    }
};
