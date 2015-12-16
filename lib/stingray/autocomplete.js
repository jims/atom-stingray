/** @babel */

export var adocProvider = {
    selector: ".source.lua",

    inclusionPriority: 100,
    excludeLowerPriority: true,

    getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix, activatedManually}) => {
        return [{text:"damn"}, {text:"you"}, {text:"autocomplete"}];
    }
};
