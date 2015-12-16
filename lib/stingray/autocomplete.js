/** @babel */

let adoc = {}

export function setAdoc(x) {
    adoc = x;
}

function stripStingray(s) {
    return s.startsWith("stingray.") ? s.substr(9) : s
}

function formatAutoComplete(key, v) {
    return {text: key};
}

export var adocProvider = {
    selector: ".source.lua",

    inclusionPriority: 100,
    excludeLowerPriority: true,

    getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) => {
        const key = stripStingray(prefix);
        return Object.keys(adoc)
            .filter(x => x.startsWith(key))
            .map(x => formatAutoComplete(x, adoc[x]));
    }
};
