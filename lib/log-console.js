/** @babel */

import * as ConsoleConnection from "./stingray/console-connection";
import * as EventUtils from "./event-utils";
import * as KeyCodes from "./key-codes";
import {IdString} from "./stingray/idstring";
import {createDomElementWithClass, createDomElementWithStyle, setDomElementClass} from "./dom-utils";
import {assetServerPort} from "./reserved-ports";

function isLogEntry(value) {
    if (value == null || typeof(value.text) !== "string")
        return false;

    if (value.system && typeof(value.system) !== "string")
        return false;

    const type = value.type;
    return type === "info" || type === "warning" || type === "error" || type === "command";
}

function getLogEntryColor(logEntry) {
    switch (logEntry.type) {
        case "info": return "#abb2bf";
        case "warning": return "#d19a66";
        case "error": return "#e06c75";
        case "command": return "#98c379";
        default: return "#abb2bf";
    }
}

function formatTime(date) {
    const time = date.toLocaleTimeString("en-GB");
    const centisecond = Math.floor(date.getMilliseconds() / 10); // 0 - 99
    const result = time + "." + ("0" + centisecond).slice(-2);
    return result; // "19:24:58.03"
}

function createLogEntryDomElement(logEntry) {
    console.assert(isLogEntry(logEntry));
    const logEntryElement = document.createElement("div");
    logEntryElement.style.borderBottom = "1px solid #181a1f";
    logEntryElement.style.padding = "4px 5px 5px 5px";

    const timeStampAreaElement = document.createElement("div");
    timeStampAreaElement.style.color = "#636d83";
    timeStampAreaElement.style.float = "left";
    timeStampAreaElement.style.width = "85px";
    timeStampAreaElement.innerText = formatTime(new Date());

    const textAreaElement = document.createElement("div");
    textAreaElement.style.marginLeft = "85px";
    textAreaElement.style.color = getLogEntryColor(logEntry);

    if (logEntry.system) {
        const textNode = document.createTextNode(logEntry.text);
        const systemSpanElement = document.createElement("span");
        systemSpanElement.innerText = "[" + logEntry.system + "] ";
        systemSpanElement.style.color = "#61afef";
        systemSpanElement.style.fontWeight = "bold";
        textAreaElement.appendChild(systemSpanElement);
        textAreaElement.appendChild(textNode);
    } else {
        textAreaElement.innerText = logEntry.text;
    }

    logEntryElement.appendChild(timeStampAreaElement);
    logEntryElement.appendChild(textAreaElement);
    return logEntryElement;
}

function createTabDomElement(title, icon) {
    console.assert(typeof(title) === "string");
    console.assert(typeof(icon) === "string");
    const tabElement = createDomElementWithClass("li", "tab");
    const titleElement = createDomElementWithClass("div", "title icon " + icon);
    titleElement.innerText = title;
    const closeIconElement = createDomElementWithClass("div", "close-icon");
    tabElement.appendChild(titleElement);
    tabElement.appendChild(closeIconElement);
    return tabElement;
}

function createDomElements(handleCommandLineKeyDown) {
    console.assert(typeof(handleCommandLineKeyDown) === "function");

    const root = createDomElementWithStyle("div", {
        height: 200,
        paddingTop: "0.5em",
        paddingRight: "0.5em",
        display: "flex",
        flexDirection: "column"
    });

    root.classList.add("panels");

    const resizeHandle = createDomElementWithStyle("div", {
        cursor: "ns-resize",
        background: "transparent",
        position: "relative",
        height: 8,
        marginBottom: -8,
        top: -10
    });

    const tabBar = createDomElementWithClass("ul", "list-inline tab-bar inset-panel");

    resizeHandle.addEventListener("mousedown", downEvent => {
        var mouseMove, mouseUp;
        const mouseDownHeight = root.clientHeight;

        mouseMove = mouseEvent => {
            const offsetY = mouseEvent.pageY - downEvent.pageY;
            const height = (mouseDownHeight - offsetY) + "px";
            root.style.height = height;
            list.style.height = height;
        };

        mouseUp = upEvent => {
            mouseMove(upEvent);
            document.removeEventListener("mousemove", mouseMove);
            document.removeEventListener("mouseup", mouseUp);
        };

        document.addEventListener("mousemove", mouseMove);
        document.addEventListener("mouseup", mouseUp);
    });

    const list = createDomElementWithStyle("div", {
        background: "#282c34",
        border: "1px solid #181a1f",
        borderTop: "none",
        fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: "90%",
        margin: 0,
        flex: 1,
        whiteSpace: "pre"
    });

    // Workaround for atom scrollbar styles not being applied correctly.
    requestAnimationFrame(() => list.style.overflowY = "scroll");

    const commandLine = document.createElement("atom-text-editor");
    commandLine.classList.add("editor");
    commandLine.classList.add("mini");
    commandLine.setAttribute("mini", null);
    commandLine.setAttribute("placeholder-text", "Send Lua to active tab");
    commandLine.style.margin = "0.5em 0.5em 2px 0.5em";
    commandLine.addEventListener("keydown", handleCommandLineKeyDown);

    root.appendChild(resizeHandle);
    root.appendChild(tabBar);
    root.appendChild(list);
    root.appendChild(commandLine);
    return {root, tabBar, list};
}

export class LogEntry {
    static fromEngineMessage(engineMessage, idStringLookup) {
        const text = idStringLookup ? IdString.replaceIdStringTagsWithStrings(idStringLookup, engineMessage.message) : engineMessage.message;
        return new LogEntry(engineMessage.level, text, engineMessage.system);
    }

    constructor(type, text, system) {
        this.type = type;
        this.text = text;

        if (system)
            this.system = system;

        console.assert(isLogEntry(this));
    }
}

class LogConsoleTab {
    constructor(url, title, icon, active, first, logEntries, getElementsCallback, getIdStringLookupCallback) {
        console.assert(typeof(url) === "string");
        console.assert(typeof(title) === "string");
        console.assert(typeof(icon) === "string");
        console.assert(active === true || active === false);
        console.assert(first === true || first === false);
        console.assert(Array.isArray(logEntries));
        console.assert(logEntries.every(isLogEntry));
        console.assert(typeof(getElementsCallback) === "function");
        console.assert(typeof(getIdStringLookupCallback) === "function");
        this._url = url;
        this._title = title;
        this._icon = icon;
        this._logEntries = logEntries;
        this._active = active;
        this._first = first;
        this._getElementsCallback = getElementsCallback;
        this._getIdStringLookupCallback = getIdStringLookupCallback;
    }

    dispose() {
        if (this._socketSubscription != null)
            this._socketSubscription.dispose();
    }

    serialize() {
        return {
            url: this._url,
            title: this._title,
            logEntries: this._logEntries
        }
    }

    createDomElements(tabBarElement, listElement, handleMouseDown) {
        console.assert(tabBarElement instanceof HTMLElement);
        console.assert(listElement instanceof HTMLElement);
        console.assert(typeof(handleMouseDown) === "function");

        const tabElement = createTabDomElement(this._title, this._icon);
        tabElement.dataset.tabUrl = this._url;
        tabElement.addEventListener("mousedown", handleMouseDown);
        setDomElementClass(tabElement, "active", this._active);

        if (this._first) {
            tabBarElement.insertBefore(tabElement, tabBarElement.firstChild);
        } else {
            tabBarElement.appendChild(tabElement);
        }

        if (this._active) {
            for (logEntry of this._logEntries) {
                const logEntryElement = createLogEntryDomElement(logEntry);
                listElement.appendChild(logEntryElement);
            }

            listElement.scrollTop = listElement.scrollHeight;
        }
    }

    destroyDomElements(tabBarElement, listElement) {
        console.assert(tabBarElement instanceof HTMLElement);
        console.assert(listElement instanceof HTMLElement);

        // Remove our tab element.
        const tabElement = tabBarElement.querySelector('[data-tab-url="' + this._url + '"]');
        console.assert(tabElement != null);
        tabBarElement.removeChild(tabElement);

        if (this._active) {
            // We are the active tab. Remove existing list elements.
            let child = null;

            while (child = listElement.lastChild)
                listElement.removeChild(child);
        }
    }

    get url() {
        return this._url;
    }

    get active() {
        return this._active;
    }

    set socketObservable(observable) {
        this._socketObservable = observable;

        if (this._socketSubscription != null)
            this._socketSubscription.dispose();

        this._socketSubscription = observable
            .filter(message => message.type == "message")
            .map(message => LogEntry.fromEngineMessage(message, this._getIdStringLookupCallback()))
            .subscribe(entry => this.addEntry(entry));
    }

    get socketObservable() {
        return this._socketObservable;
    }

    set idStringLookup(lookup) {
        this._idStringLookup = lookup;
    }

    setActive(active, tabBarElement, listElement) {
        console.assert(active === true || active === false);
        console.assert(tabBarElement == null || tabBarElement instanceof HTMLElement);
        console.assert(listElement == null || listElement instanceof HTMLElement);

        if (active === this._active)
            return;

        this._active = active;

        if (tabBarElement) {
            const tabElement = tabBarElement.querySelector('[data-tab-url="' + this._url + '"]');
            console.assert(tabElement != null);
            setDomElementClass(tabElement, "active", active);
        }

        if (listElement && active) {
            // Remove existing list elements.
            let child = null;

            while (child = listElement.lastChild)
                listElement.removeChild(child);

            // Add our list elements.
            for (logEntry of this._logEntries) {
                const logEntryElement = createLogEntryDomElement(logEntry);
                listElement.appendChild(logEntryElement);
            }

            listElement.scrollTop = listElement.scrollHeight;
        }
    }

    addEntry(logEntry) {
        const elements = this._getElementsCallback();
        const list = elements == null ? null : elements.list;
        console.assert(isLogEntry(logEntry));
        console.assert(list == null || list instanceof HTMLElement);
        this._logEntries.push(logEntry);

        if (list && this._active) {
            const logEntryElement = createLogEntryDomElement(logEntry);
            list.appendChild(logEntryElement);
            list.scrollTop = list.scrollHeight;
        }
    }
}

export class LogConsole {
    constructor(logConsoleState) {
        console.assert(typeof(logConsoleState) === "object");
        this._commandHistory = logConsoleState.commandHistory || [];
        this._commandHistoryPos = this._commandHistory.length;
        this._tabs = [];
        this._elements = null;
        this.visible = logConsoleState.visible === true;
    }

    dispose() {
        for (let t of this._tabs)
            t.dispose();

        if (this._elements != null) {
            this._elements.panel.destroy();
            this._elements = null;
        }
    }

    serialize() {
        return {
            commandHistory: this._commandHistory,
            commandHistoryPos: this._commandHistoryPos,
            tabs: this._tabs.map(x => x.serialize()),
            visible: this.visible
        }
    }

    handleEngineDetected(host, port, socketObservable) {
        const domElements = this._elements;
        const tabBarElement = domElements ? domElements.tabBar : null;
        const listElement = domElements ? domElements.list : null;
        const url = `ws://${host}:${port}`;
        let tab = this._tabs.find(x => x.url === url);

        if (tab == null) {
            // Create a new tab.
            const isAssetServer = host === "127.0.0.1" && port === assetServerPort;
            const title = isAssetServer ? "asset-server" : host + ":" + port;
            const icon = isAssetServer ? "icon-file-binary" : "icon-terminal";
            const active = this._tabs.length === 0;
            const first = isAssetServer;
            tab = new LogConsoleTab(url, title, icon, active, first, [], () => this._elements, () => this._idStringLookup);

            if (first) {
                this._tabs.unshift(tab);
            } else {
                this._tabs.push(tab);
            }

            if (domElements != null)
                tab.createDomElements(tabBarElement, listElement, this.handleTabElementMouseDown.bind(this));
        }

        tab.socketObservable = socketObservable;

        // Make the tab active.
            for (let i = 0, count = this._tabs.length; i < count; ++i) {
                const examinedTab = this._tabs[i];
            examinedTab.setActive(examinedTab === tab, tabBarElement, listElement);
        }
    }

    handleCommandLineKeyDown(evt) {
        // Disregard repeats and keypresses where any modifier keys were held.
        if (evt.repeat || evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey)
            return;

        const textEditor = evt.target.model;

        if (EventUtils.consumeIf(evt, x => x.keyCode === KeyCodes.upKey)) {
            // Replace text with previous command history entry.
            if (this._commandHistoryPos > 0) {
                textEditor.setText(this._commandHistory[--this._commandHistoryPos]);
            }
        } else if (EventUtils.consumeIf(evt, x => x.keyCode === KeyCodes.downKey)) {
            // Replace text with next command history entry.
            if (this._commandHistoryPos < this._commandHistory.length) {
                ++this._commandHistoryPos;
                const text = this._commandHistoryPos === this._commandHistory.length ? "" : this._commandHistory[this._commandHistoryPos];
                textEditor.setText(text);
            }
        } else if (EventUtils.consumeIf(evt, x => x.keyCode === KeyCodes.returnKey)) {
            // Add a new command history entry, submit the command and clear the field.
            const text = textEditor.getText();

            if (text != "") {
                this._commandHistory.push(text);
                this._commandHistoryPos = this._commandHistory.length;
                textEditor.setText("");
                const tab = this._tabs.find(tab => tab.active);
                if (tab != null)
                    tab.socketObservable.onNext(ConsoleConnection.encodeLua(text));
            }
        }
    };

    handleTabElementMouseDown(evt) {
        let tabUrl = evt.target.dataset.tabUrl;
        let isCloseOperation = false;

        if (tabUrl == null) {
            if (evt.target.classList.contains("close-icon")) {
                isCloseOperation = true;
                tabUrl = evt.target.parentNode.dataset.tabUrl;
            }
        }

        const tabIndex = this._tabs.findIndex(x => x.url === tabUrl);
        console.assert(tabIndex !== -1);

        if (isCloseOperation) {
            this.closeTabAtIndex(tabIndex);
        } else {
            this.selectTabAtIndex(tabIndex);
        }
    }

    selectTabAtIndex(tabIndex) {
        console.assert(tabIndex >= -1 && tabIndex < this._tabs.length);
        const domElements = this._elements;
        const tabBarElement = domElements ? domElements.tabBar : null;
        const listElement = domElements ? domElements.list : null;

        for (let i = 0, count = this._tabs.length; i < count; ++i) {
            const tab = this._tabs[i];
            tab.setActive(i === tabIndex, tabBarElement, listElement);
        }
    }

    closeTabAtIndex(tabIndex) {
        console.assert(tabIndex >= 0 && tabIndex < this._tabs.length);
        const tab = this._tabs[tabIndex];
        const wasActiveTab = tab.active;
        const domElements = this._elements;
        this._tabs.splice(tabIndex, 1);

        if (domElements != null)
            tab.destroyDomElements(domElements.tabBar, domElements.list);

        if (wasActiveTab) {
            // Select the next tab, if there is one.
            if (tabIndex < this._tabs.length) {
                this.selectTabAtIndex(tabIndex);
            } else {
                this.selectTabAtIndex(this._tabs.length - 1);
            }
        }

        tab.dispose();
    }

    addEntry(url, logEntry) {
        const tab = this._tabs.find(x => x.url === url);

        if (tab != null) {
            const domElements = this._elements;
            const listElement = domElements ? domElements.list : null;
            tab.addEntry(logEntry, listElement);
        }
    }

    get activeTab() {
        const tab = this._tabs.find(tab => tab.active);
        return tab;
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
            const handleCommandLineKeyDown = this.handleCommandLineKeyDown.bind(this);
            const handleTabMouseDown = this.handleTabElementMouseDown.bind(this);
            const {root, tabBar, list} = createDomElements(handleCommandLineKeyDown);
            this._tabs.forEach(tab => tab.createDomElements(tabBar, list, handleTabMouseDown));
            const panel = atom.workspace.addBottomPanel({item: root, visible: true, priority: 1});
            this._elements = {list, tabBar, panel};
        } else {
            this._elements.panel.destroy();
            this._elements = null;
        }
    }

    set idStringLookup(lookup) {
        this._idStringLookup = lookup;
    }
}
