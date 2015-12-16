/** @babel */

import {SelectListView, ScrollView} from 'atom-space-pen-views';
import marked from 'marked';
import * as Rx from 'rx';

marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    sanitize: true,
    smartLists: true,
    smartypants: false
})

let adoc = {}

export function setAdoc(x) {
    adoc = x;
}

export function has(x) {
    return adoc[x];
}

class HelpListView extends SelectListView {
    constructor() {
        super();
        this.setItems(Object.keys(adoc).sort());
        this.panel = atom.workspace.addModalPanel({item: this});
        this.panel.show();
        this.focusFilterEditor();
    }

    viewForItem(item) {
        return `<li>${item}</li>`
    }

    confirmed(item) {
        this.panel.hide();
        atom.workspace.open(`stingray-help://help/${item}`, {split: "right"});
    }

    cancelled() {
        this.panel.hide();
    }
}

export function stripStingray(s) {
    return s.startsWith("stingray.") ? s.substr(9) : s
}

function helpHtml(key) {
    const v = adoc[key];
    let md = [];

    if (v.type !== "function")
        md.push(`### ${key}`);

    switch (v.type) {
        case "function":
            v.signatures.forEach(sig => {
                var argString = sig.args.join(", ");
                var retString = (sig.rets.length==1 && sig.rets[0] == "nil") ? "" : (" : " + sig.rets.map(stripStingray).join(","))
                var s = `${key}(${argString})${retString}`
                md.push(`### ${s}`);
                let args = [];
                Rx.Observable.from(sig.args)
                    .zip(Rx.Observable.from(sig.types).map(stripStingray))
                    .forEach(x => args.push(`* \`${x[0]}\` : ${x[1]}`));
                md.push(args.join("\n"));
            });
            break;
        case "object":
            if (v.inherits)
                md.push(`#### Inherits \`${stripStingray(v.inherits)}\``);
            break;
        case "enumeration":
            md.push(`### ${key}`);
            md.push(Object.keys(v.members).map(x => `* \`${x}\``).join("\n"));
            break
    }
    md.push(v.desc);

    return marked(md.join("\n\n"));
}

class HelpView extends ScrollView {
    static content() {
        return this.div({class: 'markdown-preview native-key-bindings'})
    }
    constructor(s) {
        super()
        this.topic = s;
        this.html(helpHtml(s))
    }
    getTitle() {
        return `Stingray Help: ${this.topic}`;
    }
}

export function showHelpList() {
    let hlv = new HelpListView();
}

export function createHelpView(s) {
    return new HelpView(s);
}
