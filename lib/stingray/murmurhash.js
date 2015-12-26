/** @babel */

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
    static equals(a, b) {
        return (a[0] >>> 0) === (b[0] >>> 0) && (a[1] >>> 0) === (b[1] >>> 0);
    }

    static hash64(key) {
        var len = key.length;
        var seed = uint64(0, 0);
        var m = uint64(0xc6a4a793, 0x5bd1e995);
        var r = 47;
        var h = multiply(xor(seed, uint64(0, len)), m);
        var i = 0;
        for (; i+8 <= len; i += 8) {
            var lo = key.readUInt32LE(i);
            var hi = key.readUInt32LE(i+4);
            var k = uint64(hi, lo);
            multiplyInplace(k, m);
            xorInplace(k, shiftRight(k, r));
            multiplyInplace(k, m);

            xorInplace(h, k);
            multiplyInplace(h, m);
        }

        var remaining = len - i;
        if (remaining > 0) {
            for (var j=remaining-1; j>=0; --j)
                xorInplace(h, shiftLeft(uint64(0, key[i+j]), 8*j));

            multiplyInplace(h, m);
        }

        xorInplace(h, shiftRight(h, r));
        multiplyInplace(h, m);
        xorInplace(h, shiftRight(h, r));
        return h;
    }

    static test() {
        const input = new Buffer("I was reading about iq article on ray differentials and I remembered this... http://research.microsoft.com/en-us/projects/symbolic_differentiation_in_hlsl/ ... do anyone use that at all? glsl doesn't have it afaik.");
        const testHashes = [
            uint64(0x81c48d48, 0x12b121fd), uint64(0x9f85c7c6, 0x29431961), uint64(0x07f5da41, 0xd9a3c25d), uint64(0x13780a51, 0xae0f509d),
            uint64(0xf157ebaf, 0xc48f21a6), uint64(0x286013f3, 0x7514203b), uint64(0x287178df, 0x4571dbb4), uint64(0xf15f6afb, 0xf36590fa),
            uint64(0x5b583442, 0x30cfdf36), uint64(0x12ef32bb, 0x35328dfe), uint64(0x67cdc22e, 0xad6d1f53), uint64(0xa251a54a, 0x8d0c4c1a),
            uint64(0x7a1c3680, 0xcd8eeb92), uint64(0x775febe2, 0x9fd5655f), uint64(0x2e4b8041, 0xb55c0b29), uint64(0xe605ee6c, 0x424a0311),
            uint64(0x7cf7d490, 0x744738c1), uint64(0x937afade, 0x1786427b), uint64(0x372a771f, 0x989ff62e), uint64(0xcedbf19c, 0x4a805661),
            uint64(0xd5080aab, 0xd8779586), uint64(0xe28ea1f7, 0x26bada70), uint64(0x26bc8546, 0x286349a8), uint64(0x4f3c11f9, 0xc9018b58),
            uint64(0x23cd63ab, 0xe4043863), uint64(0x02340686, 0x3ce1e8f2), uint64(0xf3b2492d, 0x1c3853c8), uint64(0x2393c25d, 0xe5c10d00),
            uint64(0x2b93e9c8, 0xb5449fd9), uint64(0xca3578d6, 0x25661b2b), uint64(0x1f29ab0a, 0xf156ab4c), uint64(0x506ff3d1, 0xefa9dbd1),
            uint64(0x863119d6, 0x197deec7), uint64(0xf10b3eb4, 0x4a3e51ef), uint64(0x57ec7c91, 0x874e1435), uint64(0x892f204b, 0x217c5d48),
            uint64(0x0edf2f2c, 0x55e261a7), uint64(0x40762b3d, 0x001462bd), uint64(0x5b21d461, 0xbf099758), uint64(0xa4e00dfd, 0xb3549b76),
            uint64(0xb5df989c, 0x13f07105), uint64(0xaccf500a, 0xa668962a), uint64(0x9edfb1a4, 0xd661cfdd), uint64(0xaf92ee3b, 0x558c896c),
            uint64(0xe982aaf5, 0x2f911304), uint64(0x9c29ebfd, 0xdc189bea), uint64(0xd2ccd71c, 0x6c40b665), uint64(0xd11bacff, 0x0bb2e572),
            uint64(0x2bf4ce81, 0xd0140f4e), uint64(0x0ac8390a, 0xbb2e686e), uint64(0xf83107c1, 0xe9018264), uint64(0x2daef68a, 0x9bbd55b7),
            uint64(0x460a4b6c, 0x4f44239a), uint64(0x36642c55, 0xc9e40573), uint64(0xf3d329d3, 0xb11068bd), uint64(0x3a82c3dd, 0x22234089),
            uint64(0xb5c671ab, 0xa80c53c4), uint64(0xc614b8af, 0x63c6ddd1), uint64(0x4c208b93, 0x29b7d50a), uint64(0xf059b7a3, 0xd1379928),
            uint64(0xdcd8ed70, 0x9afb8113), uint64(0xc33abdf9, 0x5b892f65), uint64(0xc228040f, 0x3ec3e0c3), uint64(0x8519aa3c, 0xf0625424),
            uint64(0x64f98fad, 0xfa3535fa), uint64(0xb61d104b, 0xd48bda96), uint64(0xcad3d8e2, 0x54b52787), uint64(0x2ab8651f, 0xd72015c7),
            uint64(0x01bc4a54, 0xf0b505b4), uint64(0xf1f80c20, 0x8dd86cf9), uint64(0x5cfcc4a7, 0x2bca4466), uint64(0xa5580acd, 0xf56a7edf),
            uint64(0x3cc4ea17, 0x79bdab5e), uint64(0xb5665ab9, 0x2ad68335), uint64(0x90a694c2, 0x09fd2119), uint64(0x80342885, 0xf10ae3b5),
            uint64(0xe4b0403d, 0xab49de10), uint64(0xefccc0e3, 0x297bba2a), uint64(0x4f4a0b6a, 0xa90218fd), uint64(0x93d03970, 0x23222409),
            uint64(0x74f9f943, 0x6b22ea54), uint64(0xf5bd3676, 0xf62df1db), uint64(0x64e72cc3, 0xc27f3dad), uint64(0xa59c868c, 0x194b5d84),
            uint64(0xb3463816, 0xfeb61f14), uint64(0xa484c4f7, 0x3855b42c), uint64(0xa0da1fb3, 0x125b122c), uint64(0xb42f6db9, 0x2d104788),
            uint64(0x68ce0953, 0x5a3804ee), uint64(0xf53dad89, 0x9c70b3e0), uint64(0x4828ad59, 0x7f1febb8), uint64(0x1c8ff6f3, 0x7cf23dce),
            uint64(0x77ce4258, 0x8e605408), uint64(0xce9ffa94, 0xe35a2e32), uint64(0x822a903b, 0xee78f43b), uint64(0xfa3c4f76, 0x9254d95d),
            uint64(0xe74b3a87, 0x5da2f4c9), uint64(0x55e875dc, 0x9efa3eb5), uint64(0xbb476782, 0x09495f4f), uint64(0x4d8dbb09, 0x62326ba1),
            uint64(0x67586155, 0x16a25372), uint64(0xbc05d069, 0x1d9c377a), uint64(0x9c0223d0, 0xb95dca05), uint64(0x970db079, 0x7123fc96),
            uint64(0x9c87af8b, 0x6cc85c7c), uint64(0x87811095, 0x0401ff5a), uint64(0x22d24235, 0x95d05499), uint64(0x16d7adc3, 0xbd9873e2),
            uint64(0x85997e39, 0xa8a887ff), uint64(0x747fbaa8, 0xf0f8ab75), uint64(0xea3060f9, 0x95f21268), uint64(0x314f4b47, 0x50f06569),
            uint64(0xe1064261, 0x891515e5), uint64(0xfa59ae6d, 0xff9d72a1), uint64(0x956d147a, 0x3d2e8a6a), uint64(0x33d38c4d, 0x98a51597),
            uint64(0xe89d922e, 0x72a7b50e), uint64(0x8af1ef1b, 0x2e97fb82), uint64(0xc4985fef, 0xa2b0e86e), uint64(0xb868c94d, 0x2c3a22a3),
            uint64(0xd167d35d, 0x98d6176e), uint64(0xcb023553, 0xdaeb448c), uint64(0xb1d867f7, 0x202a665d), uint64(0xd9556538, 0x835b9999),
            uint64(0x79dc048f, 0x7d758dbd), uint64(0xfd418d26, 0x424a3e84), uint64(0x65036a7c, 0x4513d8b7), uint64(0x3b84e587, 0x48cb423c),
            uint64(0x99a4ae0b, 0xff4610f7), uint64(0x5e86f326, 0x919c1f50), uint64(0xcca4c0a0, 0x5695d05f), uint64(0x5b94252a, 0xd6200656),
            uint64(0x3c71e040, 0x487f29a9), uint64(0x070f7916, 0xf4e21331), uint64(0x87a24b68, 0x5349d862), uint64(0x2af136dd, 0xa0999654),
            uint64(0x7e7cdcb1, 0x313a1874), uint64(0xf0d79cf4, 0xb05d8b32), uint64(0x44b54b27, 0x16b6d2c9), uint64(0xe0897747, 0x5d5e0607),
            uint64(0xf929016d, 0x3014f967), uint64(0xaf015a16, 0xfaf558ff), uint64(0x57801bbc, 0x56021060), uint64(0x6baa2f6f, 0x6c7fe0a2),
            uint64(0x4e2da6dc, 0x5eb3d987), uint64(0xddfabdf9, 0x022c0b5e), uint64(0x49f8b5d5, 0xd8ea30a8), uint64(0xe844f64e, 0xbca366f8),
            uint64(0x4920e98c, 0x563d5f3c), uint64(0xb80cb9df, 0x40768272), uint64(0xf3cf68e8, 0xb2902486), uint64(0x4030b7ed, 0xd9d7f4c0),
            uint64(0x99fec3f5, 0xc197feb9), uint64(0x18e6ffd9, 0xba6f2b31), uint64(0x8bc2ddb1, 0x9ffd5333), uint64(0xda253c35, 0xee9da24c),
            uint64(0xa5b16489, 0xc7a56cd4), uint64(0xea9b3c78, 0xe4f67c11), uint64(0xfa7afd2e, 0x1591e248), uint64(0x134efc16, 0x4aaf2faa),
            uint64(0xfdd2b46e, 0xf4f45f54), uint64(0x53b40171, 0x0194c726), uint64(0x0130ea1d, 0x23e7d887), uint64(0x739003cc, 0xd7e74e23),
            uint64(0x19a973a0, 0xd78e0f1e), uint64(0x83143c0d, 0x097fd0fc), uint64(0x0fd2e6b1, 0x0a3d758d), uint64(0x21e7e76d, 0x373fc4f9),
            uint64(0x7370fde9, 0x3a1008b9), uint64(0xae9a4ba2, 0xbf4aee93), uint64(0x43366720, 0x8c7195bc), uint64(0x2738b388, 0x830910d7),
            uint64(0xbf27ef5f, 0x00fb6c6c), uint64(0x0ce48ab0, 0x89456c5c), uint64(0x61a3d414, 0xc36ba42a), uint64(0x4d8f609e, 0xb21a9a54),
            uint64(0x37dfa1f3, 0x56ecfcec), uint64(0x34f3613c, 0xa3b8ccf3), uint64(0xacba0ee9, 0x895065e7), uint64(0xf0b64c18, 0xfbe07421),
            uint64(0x3b5caa4b, 0xfcfc717d), uint64(0x3337bf42, 0xd77d0146), uint64(0xc469991c, 0x0d3aecd0), uint64(0xabf1aaf7, 0xdb74c0ae),
            uint64(0x588325e5, 0x445c5b72), uint64(0x62eedbd8, 0x61fdcc65), uint64(0xb46c59ae, 0x9b215c88), uint64(0x0cfe7638, 0x9624f557),
            uint64(0xc508d329, 0x61fbcd89), uint64(0xe8005626, 0x774b5665), uint64(0xb87f423b, 0xd35bc991), uint64(0xadaa2bbd, 0x60d11d5e),
            uint64(0x69b7a9c1, 0xcb44b082), uint64(0x4f9c5b35, 0xe3a54eba), uint64(0x6082bd14, 0xf2123f04), uint64(0xa9ff75fb, 0x2ffae70f),
            uint64(0xc6ca76a4, 0x06a7ac16), uint64(0xdf8da626, 0x7fe3fb23), uint64(0x34d18a9a, 0xc40091c7), uint64(0xd9e9282b, 0x7d8b45fe),
            uint64(0xb4ebb450, 0x5103e256), uint64(0x7fbecae1, 0xff09302b), uint64(0xea155631, 0x829d543d), uint64(0x5cc62924, 0xc92b467c),
            uint64(0xd4813862, 0xb9f63ca5), uint64(0xed14b2a2, 0x5c82cf5f), uint64(0x01621212, 0xb9c72040), uint64(0xc24e5d07, 0xfebe6461),
            uint64(0x577cef2e, 0x3c19125c), uint64(0x5176b6b9, 0x0f41a833), uint64(0xf825abb8, 0x45ad49cc), uint64(0xd593ca45, 0xe39d4721),
            uint64(0xfbf8e35c, 0x0eda6ee7), uint64(0xaf9c43ce, 0xad510441)
        ];

        for (let i = 1; i <= input.length; ++i) {
            const expected = testHashes[i-1];
            const hash = MurmurHash.hash64(input.slice(0, i));
            if (!MurmurHash.equals(hash, expected))
                console.log(i, i % 8, `hash64 of "${input.toString('utf8', 0, i)}" does not match expected result.`);
        }
    }
};

hej = MurmurHash.test;
