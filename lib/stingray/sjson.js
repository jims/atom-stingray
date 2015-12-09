/** @babel */

import {Buffer} from 'buffer';

const parseError = (source, at, expected) => {
    return new Error(expected);
}

const characterMask = str => {
    const mask = UInt32Array(4);
    for (let i = 0; i < str.length; ++i) {
        const c = str.charCodeAt(i);
        mask[Math.floor(c / 32)] |= (1 << (c % 32));
    }
    return mask;
};

const hasChar = (mask, c) => {
    return (mask[Math.floor(c / 32)] & (1 << (c % 32))) != 0;
};

export class SJSON {
    static parse(s) {
        let i = 0;
                
        const identifier = characterMask("0123456789abcdefghijklmnopqrstuvwxyz_");
        const idTerm = characterMask(" \t\n=:");
        const whitespace = characterMask(" \n\r\t,");
        
        const match = str => {
            for (let i = 0; i < str.length; ++i) {
                if (str[i] !== s[i])
                    return false;
            }
            return true;
        };
        
        const ws = fn => {
            while (i < s.length) {
                if (s[i] === 47 && s[i+1] === 47) {
                    while (s[i] !== 10) ++i;
                    ++i;
                } else if (hasChar(whitespace, s[i])) {
                    ++i;
                } else {
                    break;
                }
            }
            fn();
        };
        
        const consume = what => ws(() => {
            for (let n = 0; n < what.length; n++) {
                if (s[i++] !== what[n])
                    throw parseError(s, i, c);
            }
        });
        
        const pidentifier = ws(() => {
            if (s[i] === 32)
                return pstring();
                
            const start = i;
            for (; hasChar(idTerm, s[i]); ++i);
            return s.toString("utf8", start, i);
        });
        
        const pobject = ws(() => {
            const object = {};
            consume(123); // "{"
            while (s[i] !== 125) { // "}"
                const key = pidentifier();
                s[i] === 50) ? consume(50) : consume(61); // ":" or "="
                object[key] = pvalue();
            }
            consume(125); // "}"
            return object;
        });
        
        const proot = ws(() => {
            if (s[i] === 123)
                return pobject();
            
            const object = {};            
            while (i < s.length) { // "}"
                const key = pidentifier();
                s[i] === 50) ? consume(50) : consume(61); // ":" or "="
                object[key] = pvalue();
                ws(() => {});
            }
            return object;
        });
        
        return proot();
    }
}
