/** @babel */
import {CompositeDisposable} from "atom";
import {addThrottledEventListener, getContextPixelRatio} from "./dom-utils";
import {parseProfilerDataBuffer} from "./stingray/profiler";
import Url from "url";

// --------------------------------------------------
// Styling
// --------------------------------------------------

const font = "12px Roboto Condensed";

const colors = Object.freeze({
    background: "#292A2B",
    foreground: "#FFFFFF",
    threadLine: "#888888"
});

const gridColors = Object.freeze({
    minor: "#353738",
    major: "#494B4D",
    frameStart: "#659F0B",
    frameEnd: "#327FA6",
    fps60: "#D27524",
    fps30: "#CC210E"
});

const coreColors = Object.freeze([
    "#9F250B", "#6C1234", "#B80C4D", "#D28777", "#D27524", "#855C38", "#95883C", "#659F0B", "#457932", "#0EC582", "#31777B", "#169AB8", "#0547EB", "#7437AB", "#2D2EAC", "#C22E66"
]);


// --------------------------------------------------
// Grid lines
// --------------------------------------------------

const gridLines = (function () {
    const gridLines = [];
    const numGridLines = 100;

    // Add minor grid lines every ms.
    for (let i = 0; i < numGridLines; ++i) {
        if ((i % 10) !== 0)
            gridLines.push([i / 1000.0, gridColors.minor, null, 10000]);
    }

    // Add major grid lines every 10 ms.
    for (let i = 0; i <= numGridLines; i += 10) {
        const label = i + " ms";
        gridLines.push([i / 1000.0, gridColors.major, label, 1000]);
    }

    // Add other significant grid lines.
    gridLines.push([0, gridColors.frameStart, "0 ms", 0]);
    gridLines.push([0.0166666666666667, gridColors.fps60, "16.7 ms (60 fps)", 0]);
    gridLines.push([0.0333333333333333, gridColors.fps30, "33.3 ms (30 fps)", 0]);

    return gridLines;
})();


// --------------------------------------------------
// Utilities
// --------------------------------------------------

function getRange(data) {
    if (!data)
        return {tMin: 0, tMax: 0};

    const result = {}
    result.tMin = 1e+20;
    result.tMax = -1e+20;
    let child = data.firstChild[1];

    while (child) {
        const s = data.start[child];
        const e = data.elapsed[child];

        if (s < result.tMin)
            result.tMin = s;

        if (s + e > result.tMax)
            result.tMax = s + e;

        child = data.nextSibling[child];
    }

    return result;
}

function orderThreads(a, b) {
    return a.name < b.name
        ? -1
        : a.name > b.name
            ? 1
            : a.id < b.id
                ? -1
                : a.id > b.id
                    ? 1
                    : 0;
}


// --------------------------------------------------
// Drawing
// --------------------------------------------------

function drawEvent(context, data, i, settings, y) {
    const time = data.start[i] - settings.tMin;
    const x = time * settings.scale + settings.offset;
    const w = (data.elapsed[i] * settings.scale) - 1;
    const h = 15;
    let nextY = y + h + 5;

    if (x < settings.width && x + w > 0) {
        context.fillStyle = coreColors[data.coreId[i] % coreColors.length];
        context.fillRect(x, y, w, h);

        if (w > 50) {
            const name = stringIndex.get(data.name[i]);
            const elapsed = (data.elapsed[i] * 1000.0).toFixed(3) + " ms";
            const m = context.measureText(name);

            if (m.width + 6 < w) {
                context.fillStyle = colors.foreground;
                context.fillText(name, x + 3, y + h - 4);
            }
        }
    }

    if (w < 0.5)
        return nextY;

    let child = data.firstChild[i];

    while (child) {
        const childNextY = drawEvent(context, data, child, settings, y + h + 1);
        nextY = Math.max(nextY, childNextY);
        child = data.nextSibling[child];
    }

    return nextY;
}

function drawThreads(context, threadInfos, range, data, settings) {
    context.font = font;
    const tMin = range.tMin;
    const tMax = tMin + (1 / 60);
    const scale = settings.width / (tMax - tMin) * (globalSettings.scale || 1);
    settings = settings || {};
    settings.tMin = tMin;
    settings.scale = scale;
    settings.offset = (globalSettings.offset || 0);

    if (settings.drawGridLines) {
        const approxFrameEndMs = Math.round((range.tMax - tMin) * 1000.0);
        gridLines.push([approxFrameEndMs / 1000.0, gridColors.frameEnd, approxFrameEndMs + " ms", 0]);

        for (let i = 0, count = gridLines.length; i < count; ++i) {
            const gridLine = gridLines[i];
            const frameTime = gridLine[0]
            const color = gridLine[1]
            const label = gridLine[2];
            const cullScale = gridLine[3];
            const x = frameTime * scale + settings.offset;

            if (scale < cullScale)
                continue;

            context.fillStyle = color;
            context.fillRect(x, 0, 1, settings.height);

            if (label !== null)
                context.fillText(label, x + 4, 18);
        }

        gridLines.pop();
    }

    let nextY = 24;

    for (let i = 0; i < threadInfos.length; ++i) {
        const threadInfo = threadInfos[i];
        const threadId = threadInfo.id;
        const threadName = threadInfo.name;
        const y = nextY;
        let foundChild = false;
        let child = data ? data.firstChild[1] : 0;

        while (child) {
            if (data.threadId[child] == threadId) {
                foundChild = true;
                const childNextY = drawEvent(context, data, child, settings, y);
                nextY = Math.max(nextY, childNextY);
            }

            child = data.nextSibling[child];
        }

        const threadHeight = Math.max(nextY - y, threadHeights[threadId] || 0);
        threadHeights[threadId] = threadHeight;

        if (settings.drawThreadHeaders && threadHeight > 0) {
            context.fillStyle = colors.threadLine;
            const threadLabel = threadName + " (" + threadInfo.key + ")";
            context.fillText(threadLabel, 10, y - 6);
            context.fillRect(0, y - 3, settings.width, 1);
        }

        nextY = y + threadHeight + 20;
    }
}

// --------------------------------------------------
// Profiler (model)
// --------------------------------------------------

class Profiler {
    constructor(url) {
        this.offset = 0;
        this.scale = 1;
        this.paused = false;
        this.threadInfos = null;
        this.threadHeights = {};
        this.stringIndex = new Map();
        this.historyData = [];
        this.lastData = null;
        this._url = url;
        this._allThreads = {};
        this._socket = new WebSocket(`ws://${url.host}/profiler`);
        this._socket.binaryType = "arraybuffer";

        this._socket.onmessage = event => {
            if (typeof(event.data) === "string") {
                const msg = JSON.parse(event.data);

                if (msg.type === "profiler_threads") {
                    this._recvProfilerThreads(msg);
                }
                else if (msg.type === "profiler_strings") {
                    this._recvProfilerStrings(msg);
                }
            }
            else {
                this._recvProfilerDataBuffer(event.data);
            }
        }
    }

    dispose() {
        this._socket.close();
    }

    getIconName() {
        return "dashboard";
    }

    getTitle() {
        return this._url.host;
    }

    _recvProfilerThreads(msg) {
        this.threadInfos = [];
        const a = [];
        const threads = msg["threads"];
        const allThreads = this._allThreads;

        for (let i = 0; i < threads.length; ++i)
            allThreads[threads[i]["id"]] = threads[i]["name"];

        for (let key in allThreads) {
            if (!allThreads.hasOwnProperty(key))
                continue;

            a.push({key: key, id: parseInt(key, 16), name: allThreads[key]});
        }

        a.sort(orderThreads);

        for (let i = 0; i < a.length; ++i)
            this.threadInfos.push(a[i]);
    }

    _recvProfilerStrings(msg) {
        const strings = msg["strings"];
        const ab = new ArrayBuffer(8);
        const u32 = new Uint32Array(ab);
        const f = new Float64Array(ab);

        for (let key in strings) {
            if (!strings.hasOwnProperty(key))
                continue;

            const hi = parseInt(key.substring(0, 8), 16);
            const lo = parseInt(key.substring(8, 16), 16);
            u32[1] = hi;
            u32[0] = lo;
            const name = strings[key];
            this.stringIndex.set(f[0], name);
        }
    }

    _recvProfilerDataBuffer(buffer) {
        if (this.paused)
            return;

        if (this.historyData.length > 1000) {
            this.historyData.copyWithin(0, 1);
            this.historyData.length = 1000;
        }

        this.lastData = parseProfilerDataBuffer(buffer);
        this.historyData.push(this.lastData);
    }
}


// --------------------------------------------------
// ProfilerElement (view)
// --------------------------------------------------

class ProfilerElementImpl extends HTMLElement {
    initialize(profiler) {
        console.assert(profiler instanceof Profiler);
        const shadowRoot = this.createShadowRoot();
        const profilerContainer = document.createElement("div");
        const canvas = document.createElement("canvas");
        profilerContainer.style.width = "100%";
        profilerContainer.style.height = "100%";
        profilerContainer.appendChild(canvas);
        shadowRoot.appendChild(profilerContainer);
        this._profiler = profiler;
        this._profilerContainer = profilerContainer;
        this._canvas = canvas;
        this._context = canvas.getContext("2d");
        this._debugTextLines = [];
        this.tabIndex = -1;
        this.classList.add("stingray-profiler", "pane-item");
    }

    attachedCallback() {
        this._canvas.addEventListener("wheel", this.canvasOnMouseWheel.bind(this));
        this._canvas.addEventListener("mousedown", this.canvasOnMouseWheel.bind(this));
        addThrottledEventListener(window, "resize", this.windowOnResize.bind(this));
        this.windowOnResize();
        this.update();
    }

    detachedCallback() {
        this._profiler.dispose();
    }

    debugWriteLine(text) {
        this._debugTextLines.push(text);
    }

    debugDrawLines() {
        const context = this._context;
        const debugTextLines = this._debugTextLines;
        const lineHeight = 16;
        context.font = font;
        context.fillStyle = colors.foreground;

        for (let i = 0, count = debugTextLines.length; i < count; ++i) {
            const textLine = debugTextLines[i];
            context.fillText(textLine, 10, 10 + lineHeight * i);
        }

        debugTextLines.length = 0;
    }

    windowOnResize() {
        const context = this._context;
        const pixelRatio = getContextPixelRatio(context);
        const profilerContainer = this._profilerContainer;
        const canvas = this._canvas;
        const width = profilerContainer.clientWidth;
        const height = profilerContainer.clientHeight;
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        canvas.style.width = width + "px";
        canvas.style.width = width + "px";
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    canvasOnMouseWheel(event) {
        const profiler = this._profiler;
        const o1 = profiler.offset;
        const s1 = profiler.scale;
        const s2 = event.deltaY > 0 ? s1 * 1.2 : s1 / 1.2;
        const o2 = o1 + (event.clientX - o1) * (1 - s2 / s1);
        profiler.scale = s2;
        profiler.offset = o2;
    }

    canvasOnMouseDown(event) {
        const profiler = this._profiler;
        let lastX = event.screenX;

        function documentOnMouseMove(event) {
            const delta = event.screenX - lastX;
            lastX = event.screenX;
            profiler.offset += delta;
        }

        function documentOnMouseUp(event) {
            document.body.style.cursor = "default";
            document.removeEventListener("mousemove", documentOnMouseMove);
            document.removeEventListener("mouseup", documentOnMouseUp);
        }

        document.body.style.cursor = "all-scroll";
        document.addEventListener("mousemove", documentOnMouseMove);
        document.addEventListener("mouseup", documentOnMouseUp);
    }

    update() {
        requestAnimationFrame(this.update.bind(this));
        const profiler = this._profiler;
        const lastData = profiler.lastData;
        const threadInfos = profiler.threadInfos;

        if (!lastData || !threadInfos)
            return;

        const canvas = this._canvas;
        const context = this._context;
        const width = canvas.width;
        const height = canvas.height;
        const range = getRange(profiler.lastData);
        context.fillStyle = colors.background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawThreads(context, threadInfos, range, lastData, {width, height, drawGridLines: true, drawThreadHeaders: true});
        this.debugDrawLines(context);
    }
}

const ProfilerElement = document.registerElement("stingray-profiler", {prototype: ProfilerElementImpl.prototype, extends: "div"});


// --------------------------------------------------
// ProfilingService (registers with Atom)
// --------------------------------------------------

export class ProfilingService {
    constructor(serializedState) {
        console.assert(typeof(serializedState) === "object");
        this._disposables = new CompositeDisposable();
        this._disposables.add(atom.views.addViewProvider(Profiler, this.createView.bind(this)))
        this._disposables.add(atom.workspace.addOpener(this.opener.bind(this)));
    }

    dispose() {
        this._disposables.dispose();
    }

    serialize() {
        return {};
    }

    opener(uri) {
        const url = Url.parse(uri);

        if (url.protocol === "stingray-profiler:") {
            return new Profiler(url);
        }
    }

    createView(profiler) {
        const element = new ProfilerElement();
        element.initialize(profiler);
        return element;
    }
}
