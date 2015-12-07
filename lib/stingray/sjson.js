/** @babel */

const parseError = (source, at, expected) => {
    return new Error(expected);
}

export class SJSON {
    static parse(s) {
        let obj = { state: 0 };
        let i = 0;
        const consume = what => {
            for (let c of what) {
                if (s[i++] !== c)
                    throw parseError(s, i, c);
            }
        };
        
        const proot = () => {
            
        };
        
        consume('{');
        consume('L');
        
        return obj;
    }
}
