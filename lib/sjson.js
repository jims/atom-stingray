/** @babel */

class ParseError extends Error {
    constructor(source, at, expected) {
        super(expected)
    }
}

export class SJSON {
    static parse(s) {
        let obj = { state: 0 };
        let i = 0;
        const consume = function(what) {
            for (let c of what) {
                if (s[i++] !== c)
                    throw new ParseError(s, i, c);
            }
        };
        
        const proot = function() {
            
        };
        
        consume('{');
        consume('L');
        
        return obj;
    }
}

export default SJSON;
