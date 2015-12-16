/** @babel */

import fs from 'fs';
import path from 'path';
import * as Rx from 'rx';

function findParent(o, adoc)
{
    const inherits = o.inherits;
    if (!inherits)
        return;
    const keys = inherits.split(".");
    let result = adoc;
    keys.forEach(k => {result = result.members[k];})
    return result;
}

function addRecursively(lookup, dir, name, o, adoc)
{
    const absName = dir === "" ? name : dir + "." + name;
    lookup[absName] = o;
    if (!o.members) return;

    Object.keys(o.members)
        .forEach(key => addRecursively(lookup, absName, key, o.members[key], adoc));

    let parent = findParent(o, adoc);
    while (parent) {
        Object.keys(parent.members)
            .forEach(key => addRecursively(lookup, absName, key, parent.members[key], adoc));
        parent = findParent(parent, adoc);
    }
}

function stingrayLookup(adoc)
{
    let root = adoc.members.stingray;
    let lookup = {}
    addRecursively(lookup, "", "", root, adoc);
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
