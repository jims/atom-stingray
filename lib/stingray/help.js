/** @babel */

import {SelectListView} from 'atom-space-pen-views';

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
    console.log(item);
  }

  cancelled() {
    this.panel.hide();
  }
}

export function help() {
  let hlv = new HelpListView();
  // hlv.toggle();
}
