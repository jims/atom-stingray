/** @babel */

import fs from 'fs';
import path from 'path';
import * as Rx from 'rx';

function addRecursively(lookup, dir, name, o)
{
    const absName = dir === "" ? name : dir + "." + name;
    lookup[absName] = o;
    if (!o.members) return;

    Object.keys(o.members)
        .forEach(key => addRecursively(lookup, absName, key, o.members[key]));
}

function stingrayLookup(adoc)
{
    let root = adoc.members.stingray;
    let lookup = {}
    addRecursively(lookup, "", "", root);
    return lookup;
}

const readFile = Rx.Observable.fromNodeCallback(fs.readFile);
export function adoc(binDir) {
    return Rx.Observable.just(binDir)
        .map(x => path.join(x, "editor", "resources", "lua_api_stingray3d.json"))
        .flatMap(x => readFile(x))
        .map(x => JSON.parse(x))
        .map(x => stingrayLookup(x));
}
