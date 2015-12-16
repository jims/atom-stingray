/** @babel */

let adoc = {}

export function setAdoc(x) {
    adoc = x;
}

function stripStingray(s) {
    return s.startsWith("stingray.") ? s.substr(9) : s
}

function formatAutoComplete(key, v, replacementPrefix) {
    let o = {
        text: key,
        replacementPrefix: replacementPrefix,
        type: "value",
        description: v.desc
    }
    switch (v.type) {
        case "function":
            const sig = v.signatures[0];
            const args = sig.args.map((x,i) => `\${${i+1}:${x}}`).join(", ");
            o.snippet = `${key}(${args})`;
            o.type = "function";
            o.leftLabel = sig.rets.map(stripStingray).join(",");
            break;
        case "object":
            o.type = "class";
    }
    return o;
}

function getPrefix(te, pos, f) {
    var row = pos.row;
    var start = pos.column;
    var end = pos.column;
    var line = te.lineTextForBufferRow(row);
    while (start > 0) {
        var s = line.substr(start-1, end-start+1)
        if (!f(s))
            break;
        start--;
    }
    return line.substr(start, end-start);
}

export var adocProvider = {
    selector: ".source.lua",

    inclusionPriority: 100,
    excludeLowerPriority: true,

    getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) => {
        const myPrefix = getPrefix(editor, bufferPosition, s => s.match(/^[a-zA-Z._0-9]*$/))
        const key = stripStingray(myPrefix);
        if (key.length == 0) return [];
        return Object.keys(adoc)
            .filter(x => x.startsWith(key))
            .map(x => formatAutoComplete(x, adoc[x], key));
    }
};
