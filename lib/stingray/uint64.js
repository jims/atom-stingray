/** @babel */

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

    static test() {
        console.assert((new UInt64(0,0)).toString() == "0x0000000000000000");
        console.assert((new UInt64(1,2)).toString() == "0x0000000100000002");
    }

};
