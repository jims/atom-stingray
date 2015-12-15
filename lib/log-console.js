/** @babel */
import * as ConsoleConnection from "./stingray/console-connection";
import {createDomElementWithClass, createDomElementWithStyle, setDomElementClass} from './dom-utils';

const assetServerPort = 14032;

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

function createDomElements() {
    const root = createDomElementWithStyle("div", {
        height: 100,
        paddingTop: "0.5em",
        paddingRight: "0.5em"
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

    const list = createDomElementWithStyle("ul", {
        background: "#282c34",
        border: "1px solid #181a1f",
        borderTop: "none",
        height: "100%",
        overflowY: "scroll",
        margin: 0
    });

    root.appendChild(resizeHandle);
    root.appendChild(tabBar);
    root.appendChild(list);
    return {root, tabBar, list};
}

export class LogEntry {
    constructor(type, text) {
        this.type = type;
        this.text = text;
        console.assert(isLogEntry(this));
    }
}

class LogConsoleTab {
    constructor(id, title, icon, active, first, logEntries) {
        console.assert(typeof(id) === "string");
        console.assert(typeof(title) === "string");
        console.assert(typeof(icon) === "string");
        console.assert(active === true || active === false);
        console.assert(first === true || first === false);
        console.assert(Array.isArray(logEntries));
        console.assert(logEntries.every(isLogEntry));
        this._id = id;
        this._title = title;
        this._icon = icon;
        this._logEntries = logEntries;
        this._active = active;
        this._first = first;
    }

    serialize() {
        return {
            id: this._id,
            title: this._title,
            logEntries: this._logEntries
        }
    }

    createDomElements(tabBarElement, listElement, handleMouseDown) {
        console.assert(tabBarElement instanceof HTMLElement);
        console.assert(listElement instanceof HTMLElement);
        console.assert(typeof(handleMouseDown) === "function");

        const tabElement = createTabDomElement(this._title, this._icon);
        tabElement.dataset.tabId = this._id;
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
        }
    }

    destroyDomElements(tabBarElement, listElement) {
        console.assert(tabBarElement instanceof HTMLElement);
        console.assert(listElement instanceof HTMLElement);

        // Remove our tab element.
        const tabElement = tabBarElement.querySelector('[data-tab-id="' + this._id + '"]');
        console.assert(tabElement != null);
        tabBarElement.removeChild(tabElement);

        if (this._active) {
            // We are the active tab. Remove existing list elements.
            let child = null;

            while (child = listElement.lastChild)
                listElement.removeChild(child);
        }
    }

    get active() {
        return this._active;
    }

    setActive(active, tabBarElement, listElement) {
        console.assert(active === true || active === false);
        console.assert(tabBarElement == null || tabBarElement instanceof HTMLElement);
        console.assert(listElement == null || listElement instanceof HTMLElement);

        if (active === this._active)
            return;

        this._active = active;

        if (tabBarElement) {
            const tabElement = tabBarElement.querySelector('[data-tab-id="' + this._id + '"]');
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
        }
    }

    addEntry(logEntry, listElement) {
        console.assert(isLogEntry(logEntry));
        console.assert(listElement == null || listElement instanceof HTMLElement);
        this._logEntries.push(logEntry);

        if (listElement && this._active) {
            const logEntryElement = createLogEntryDomElement(logEntry);
            listElement.appendChild(logEntryElement);
        }
    }

    hasId(id) {
        return this._id === id;
    }
}

export class LogConsole {
    constructor(logConsoleState) {
        console.assert(typeof(logConsoleState) === "object");
        this._tabs = [];
        this._elements = null;
        this.visible = logConsoleState.visible === true;

        const assetServerPorts = ConsoleConnection.observableOfOpenPorts(assetServerPort);
        const localEnginePorts = ConsoleConnection.observableOfOpenPorts(14000, 14030);
        const allConsolePorts = assetServerPorts.merge(localEnginePorts);

        this._enginePortOpenedSubscription = allConsolePorts
            .filter(x => x.status == "opened")
            .subscribe(x => this.handleEngineDetected("localhost", x.port));
    }

    dispose() {
        if (this._elements != null) {
            this._elements.panel.destroy();
            this._elements = null;
        }

        if (this._enginePortOpenedSubscription != null) {
            this._enginePortOpenedSubscription.dispose();
            this._enginePortOpenedSubscription = null;
        }
    }

    serialize() {
        return {
            tabs: this._tabs.map(x => x.serialize()),
            visible: this.visible
        }
    }

    handleEngineDetected(host, port) {
        const url = "ws://" + host + ":" + port;
        const id = url;
        let tab = this._tabs.find(x => x.hasId(id));

        if (tab == null) {
            // Create a new tab.
            const isAssetServer = host === "localhost" && port === assetServerPort;
            const title = isAssetServer ? "asset-server" : host + ":" + port;
            const icon = isAssetServer ? "icon-file-binary" : "icon-terminal";
            const active = this._tabs.length === 0;
            const first = isAssetServer;
            tab = new LogConsoleTab(id, title, icon, active, first, []);
            tab.addEntry(new LogEntry("info", "Created tab for engine detected at " + url), null);

            if (first) {
                this._tabs.unshift(tab);
            } else {
                this._tabs.push(tab);
            }

            const domElements = this._elements;

            if (domElements != null)
                tab.createDomElements(domElements.tabBar, domElements.list, this.handleTabElementMouseDown.bind(this));
        }

        // TODO: Attach the tab to the engine output.
    }

    handleTabElementMouseDown(evt) {
        let tabId = evt.target.dataset.tabId;
        let isCloseOperation = false;

        if (tabId == null) {
            if (evt.target.classList.contains("close-icon")) {
                isCloseOperation = true;
                tabId = evt.target.parentNode.dataset.tabId;
            }
        }

        const tabIndex = this._tabs.findIndex(x => x.hasId(tabId));
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

        for (let i = 0, count = this._tabs.length; i < count; ++i) {
            const tab = this._tabs[i];
            tab.setActive(i === tabIndex, domElements.tabBar, domElements.list);
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
            const {root, tabBar, list} = createDomElements();
            const handleMouseDown = this.handleTabElementMouseDown.bind(this);
            this._tabs.forEach(tab => tab.createDomElements(tabBar, list, handleMouseDown));
            const panel = atom.workspace.addBottomPanel({item: root, visible: true, priority: 1});
            this._elements = {list, tabBar, panel};
        } else {
            this._elements.panel.destroy();
            this._elements = null;
        }
    }
}
