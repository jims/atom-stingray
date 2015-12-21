/** @babel */

import {UINT64} from 'cuint';

function uint64(hi, lo) {
    return [hi, lo];
}

function xor(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
}

function xorInplace(a, b) {
    a[0] ^= b[0];
    a[1] ^= b[1];
}

function shiftRight(a, n) {
    if ((n &= 63) == 0) return a;
    
    var hi = a[0];
    var lo = a[1];
    return n < 32
        ? [hi >>> n, (hi << (32-n)) | (lo >>> n)]
        : [0, hi >>> (n-32)];
}

function shiftRightInplace(a, n) {
    if ((n &= 63) == 0) return;
    
    var hi = a[0];
    var lo = a[1];
    if (n < 32) {
        a[0] = hi >>> n;
        a[1] = (hi << (32-n)) | (lo >>> n);
    } else {
        a[0] = 0;
        a[1] = hi >>> (32-n);
    }
}

function shiftLeft(a, n) {
    if ((n &= 63) == 0) return a;
    
    var hi = a[0];
    var lo = a[1];
    return n < 32
        ? [(hi << n) | (lo >>> (32-n)), lo << n]
        : [lo << (n-32), 0];
}

function multiplyInplace(a, b) {
    var a48 = a[0] >>> 16;
    var a32 = a[0] & 0xffff;
    var a16 = a[1] >>> 16;
    var a00 = a[1] & 0xffff;

    var b48 = b[0] >>> 16;
    var b32 = b[0] & 0xffff;
    var b16 = b[1] >>> 16;
    var b00 = b[1] & 0xffff;

    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 * b00;
    c16 += c00 >>> 16;
    c00 &= 0xffff;
    c16 += a16 * b00;
    c32 += c16 >>> 16;
    c16 &= 0xffff;
    c16 += a00 * b16;
    c32 += c16 >>> 16;
    c16 &= 0xffff;
    c32 += a32 * b00;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c32 += a16 * b16;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c32 += a00 * b32;
    c48 += c32 >>> 16;
    c32 &= 0xffff;
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
    c48 &= 0xffff;
    a[0] = (c48 << 16) | c32;
    a[1] = (c16 << 16) | c00;
}

function multiply(a, b) {
    var copy = [a[0], a[1]];
    multiplyInplace(copy, b);
    return copy;
}

export class MurmurHash {
    static hash64(key) {
        var seed = uint64(0, 0);
        var m = uint64(0xc6a4a793, 0x5bd1e995);
        var r = 47;
        var h = multiply(xor(seed, uint64(0, key.length)), m);
        var i = 0;
        for (; i+8 <= key.length; i += 8) {
            var k = uint64(key.readUInt32LE(i+4), key.readUInt32LE(i));            
            multiplyInplace(k, m);
            xorInplace(k, shiftRight(k, r));
            multiplyInplace(k, m);
            
            xorInplace(h, k);
            multiplyInplace(h, m);
        }

        var remaining = key.length - i;
        for (var j=remaining-1; j>=0; --j)
            xorInplace(h, shiftLeft(uint64(0, key[i+j]), 8*j));

        multiplyInplace(h, m);

        xorInplace(h, shiftRight(h, r));
        multiplyInplace(h, m);
        xorInplace(h, shiftRight(h, r));
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
