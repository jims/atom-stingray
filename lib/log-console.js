/** @babel */

import {createStyledElement} from './dom-utils';

function isLogEntry(value) {
    if (value == null || typeof(value.text) !== "string")
        return false;

    const type = value.type;
    return type === "info" || type === "warning" || type === "error";
}

function createLogEntryDomElement(logEntry) {
    console.assert(isLogEntry(logEntry));
    const element = document.createElement("li");
    element.innerText = logEntry.text;
    return element;
}

function createDomElements(logEntries) {
    const root = createStyledElement("div", {
        height: 100
    });

    const resizeHandle = createStyledElement("div", {
        cursor: "ns-resize",
        background: "transparent",
        position: "relative",
        height: 5,
        marginBottom: -5,
        top: -3
    });

    resizeHandle.addEventListener("mousedown", downEvent => {
        const mouseDownHeight = root.clientHeight;

        const mouseMove = mouseEvent => {
            const offsetY = mouseEvent.pageY - downEvent.pageY;
            const height = (mouseDownHeight - offsetY) + "px";
            root.style.height = height;
            list.style.height = height;
        };

        const mouseUp = upEvent => {
            mouseMove(upEvent);
            document.removeEventListener("mousemove", mouseMove);
            document.removeEventListener("mouseup", mouseUp);
        };

        document.addEventListener("mousemove", mouseMove);
        document.addEventListener("mouseup", mouseUp);
    });

    const list = createStyledElement("ul", {
        height: "100%",
        overflowY: "scroll",
        margin: 0
    });

    for (logEntry of logEntries) {
        const listElement = createLogEntryDomElement(logEntry);
        list.appendChild(listElement);
    }

    root.appendChild(resizeHandle);
    root.appendChild(list);
    return {root: root, list: list};
}

export class LogEntry {
    constructor(type, text) {
        this.type = type;
        this.text = text;
        console.assert(isLogEntry(this));
    }
}

export class LogConsole {
    constructor(logConsoleState) {
        console.assert(typeof(logConsoleState) === "object");
        const logEntries = logConsoleState.logEntries || [];
        console.assert(logEntries.every(isLogEntry));
        this._logEntries = logEntries;
        this._elements = null;
        this.visible = logConsoleState.visible === true;
    }

    dispose() {
        if (this._elements != null) {
            this._elements.panel.destroy();
            this._elements = null;
        }
    }

    serialize() {
        return {
            logEntries: this._logEntries,
            visible: this.visible
        }
    }

    addEntry(logEntry) {
        console.assert(isLogEntry(logEntry));
        this._logEntries.push(logEntry);

        if (this._elements !== null) {
            const listElement = createLogEntryDomElement(logEntry);
            this._elements.list.appendChild(listElement);
        }
    }

    get visible() {
        return this._elements != null;
    }

    set visible(value) {
        console.assert(value === true || value === false);

        if (value === this.visible)
            return;

        if (value) {
            console.assert(this._elements == null);
            const {root, list} = createDomElements(this._logEntries);
            const panel = atom.workspace.addBottomPanel({item: root, visible: true, priority: 1});
            this._elements = {list: list, panel: panel};
        } else {
            this._elements.panel.destroy();
            this._elements = null;
        }
    }
}
