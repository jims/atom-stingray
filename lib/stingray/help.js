/** @babel */

import {SelectListView, ScrollView} from 'atom-space-pen-views';

let adoc = {}

export function setAdoc(x) {
  adoc = x;
}

class HelpListView extends SelectListView {
  constructor() {
    super();
    this.setItems(Object.keys(adoc));
    this.panel = atom.workspace.addModalPanel({item: this});
    this.panel.show();
    this.focusFilterEditor();
  }

  viewForItem(item) {
    return "<li>" + item + "</li>"
  }

  confirmed(item) {
    this.panel.hide();
    atom.workspace.open("stingray-help://help/" + item, {split: "right"});
  }

  cancelled() {
    this.panel.hide();
  }
}

function helpHtml(key)
{
  const v = adoc[key];
  let html = "";

  if (v.type === "function") {
    v.signatures.forEach(sig => {
      var s = key + "(" + sig.args.join(",") + ") : " + sig.rets.join(",");
      html = html + "<h3>" + s + "</h3>";
      html = html + "<dl><dt>self</dt><dd>Unit</dd></dl>"
    });
  }

  html = html + "<p>" + v.desc + "</p>";
  html = html + "<hr>";
  html = html + "<pre>" + JSON.stringify(v,null,4) + "</pre>";
  return html;
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
    return "Stingray Help: " + this.topic;
  }
}

export function showHelpList() {
  let hlv = new HelpListView();
}

export function createHelpView(s) {
  return new HelpView(s);
}
