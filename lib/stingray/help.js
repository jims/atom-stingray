/** @babel */

import {SelectListView, ScrollView} from 'atom-space-pen-views';

let data = {
    "Application.argv": "Bla bla bla",
    "Application.borg": "Blorg blog blorg"
}

class HelpListView extends SelectListView {
  constructor() {
    super();
    this.setItems(Object.keys(data));
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

class HelpView extends ScrollView {
  static content() {
    return this.div({class: 'markdown-preview native-key-bindings'})
  }
  constructor(s) {
    super()
    this.topic = s;
    this.html("<h1>" + this.topic + "</h1> <p>" + data[this.topic] + "</p>");
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
