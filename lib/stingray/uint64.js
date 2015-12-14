/** @babel */

// Returns two's complement of value for bitwise operations.
function _2c(v)
{
    if (v < 0x80000000)
        return (v|0);
    else
        return (v - 0x100000000)|0;
}

export class UInt64 {
    constructor(hi, lo) {
        this.hi = hi;
        this.lo = lo;
    }

    toString() {
        let c = [];
        c[7] = (this.hi >> 24) & 0xff;
        c[6] = (this.hi >> 16) & 0xff;
        c[5] = (this.hi >> 8) & 0xff;
        c[4] = (this.hi >> 0) & 0xff;
        c[3] = (this.lo >> 24) & 0xff;
        c[2] = (this.lo >> 16) & 0xff;
        c[1] = (this.lo >> 8) & 0xff;
        c[0] = (this.lo >> 0) & 0xff;

        let s = "0x";
        for (let i=7; i>=0; --i)
            s = s + (c[i] > 0xf ? '' : '0') + c[i].toString(16);
        return s;
    }

    xor(other) {
        return new UInt64((_2c(this.hi) ^ _2c(other.hi))>>>0, (_2c(this.lo) ^ _2c(other.lo))>>>0);
    }


    static test() {
        var zero = new UInt64(0,0);
        let a = new UInt64(0xa0000000, 0xa0000000);

        console.assert(zero.toString() == "0x0000000000000000");
        console.assert((new UInt64(1,2)).toString() == "0x0000000100000002");

        console.assert(a.xor(zero).toString() == a.toString());
        console.assert(a.xor(a).toString() == zero.toString());
    }

};
