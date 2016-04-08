/** @babel */
import {CompositeDisposable} from "atom";
import {addThrottledEventListener, getContextPixelRatio} from "./dom-utils";
import {parseProfilerDataBuffer} from "./stingray/profiler";
import Url from "url";

// --------------------------------------------------
// Styling
// --------------------------------------------------

const font = ".SFNSText-Regular";

const palette = Object.freeze({
    lightRed: "#c97071",
    mediumRed: "#ac4142",
    darkRed: "#be2f31",
    lightGreen: "#b2c38b",
    mediumGreen: "#90a959",
    darkGreen: "#66783e",
    lightYellow: "#fae0bc",
    mediumYellow: "#f4bf75",
    darkYellow: "#ee9e2e",
    lightBlue: "#9dc0ce",
    mediumBlue: "#6a9fb5",
    darkBlue: "#46788d",
    lightMaroon: "#be7953",
    mediumMaroon: "#8f5536",
    darkMaroon: "#7c4426",
    lightPurple: "#c7a4c0",
    mediumPurple: "#aa759f",
    darkPurple: "#825078",
    lightOrange: "#e1ad83",
    mediumOrange: "#d28445",
    darkOrange: "#a35f27",
    lightCyan: "#a7d0c9",
    mediumCyan: "#75b5aa",
    darkCyan: "#4d9085",
    lightPink: "#ff4ddb",
    mediumPink: "#ff00cc",
    darkPink: "#cc00a3"
});

const theme = Object.freeze({
    lightForeground: "rgb(215, 218, 224)",
    mediumForeground: "rgb(157, 165, 180)",
    darkForeground: "rgba(157, 165, 180, 0.6)",
    darkestForeground: "rgba(157, 165, 180, 0.2)",
    lightBackground: "#353b45",
    mediumBackground: "#282c34",
    darkBackground: "#1e2127",
    darkOutline: "#181a1f"
});

const profilerColors = Object.freeze({
    background: theme.mediumBackground,
    foreground: theme.mediumForeground,
    threadLine: theme.mediumForeground
});

const gridColors = Object.freeze({
    minor: theme.darkestForeground,
    major: theme.darkForeground,
    frameStart: palette.mediumGreen,
    frameEnd: palette.mediumBlue,
    fps60: palette.mediumOrange,
    fps30: palette.lightRed
});

const coreColors = Object.freeze([
    palette.lightRed,
    palette.mediumGreen,
    palette.mediumYellow,
    palette.mediumBlue,
    palette.lightMaroon,
    palette.mediumPurple,
    palette.mediumCyan,
    palette.mediumOrange
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

function drawEvent(context, stringIndex, data, i, settings, y) {
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
            const label = name + " " + elapsed;
            const m = context.measureText(label);

            if (m.width + 6 < w) {
                context.fillStyle = profilerColors.background;
                context.fillText(label, x + 3, y + h - 4);
            }
        }
    }

    if (w < 0.5)
        return nextY;

    let child = data.firstChild[i];

    while (child) {
        const childNextY = drawEvent(context, stringIndex, data, child, settings, y + h + 1);
        nextY = Math.max(nextY, childNextY);
        child = data.nextSibling[child];
    }

    return nextY;
}

function drawThreads(context, threadInfos, threadHeights, stringIndex, range, scale, offset, data, settings) {
    context.font = font;
    const tMin = range.tMin;
    const tMax = tMin + (1 / 60);
    settings = settings || {};
    settings.tMin = tMin;
    settings.scale = settings.width / (tMax - tMin) * (scale || 1);
    settings.offset = (offset || 0);

    if (settings.drawGridLines) {
        const approxFrameEndMs = Math.round((range.tMax - tMin) * 1000.0);
        gridLines.push([approxFrameEndMs / 1000.0, gridColors.frameEnd, approxFrameEndMs + " ms", 0]);

        for (let i = 0, count = gridLines.length; i < count; ++i) {
            const gridLine = gridLines[i];
            const frameTime = gridLine[0]
            const color = gridLine[1]
            const label = gridLine[2];
            const cullScale = gridLine[3];
            const x = frameTime * settings.scale + settings.offset;

            if (settings.scale < cullScale)
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
                const childNextY = drawEvent(context, stringIndex, data, child, settings, y);
                nextY = Math.max(nextY, childNextY);
            }

            child = data.nextSibling[child];
        }

        const threadHeight = Math.max(nextY - y, threadHeights[threadId] || 0);
        threadHeights[threadId] = threadHeight;

        if (settings.drawThreadHeaders && threadHeight > 0) {
            context.fillStyle = profilerColors.threadLine;
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
        this._canvas.addEventListener("mousedown", this.canvasOnMouseDown.bind(this));
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
        context.fillStyle = profilerColors.foreground;

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
        const elementX = event.target.getBoundingClientRect().left;
        const profiler = this._profiler;
        const o1 = profiler.offset;
        const s1 = profiler.scale;
        const s2 = event.deltaY > 0 ? s1 * 1.2 : s1 / 1.2;
        const o2 = o1 + (event.clientX - elementX - o1) * (1 - s2 / s1);
        profiler.scale = s2;
        profiler.offset = o2;
    }

    canvasOnMouseDown(event) {
        if (event.button !== 0)
            return;

        const profiler = this._profiler;
        let lastX = event.clientX;

        function documentOnMouseMove(event) {
            const delta = event.clientX - lastX;
            lastX = event.clientX;
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

        const threadHeights = profiler.threadHeights;
        const stringIndex = profiler.stringIndex;
        const canvas = this._canvas;
        const context = this._context;
        const width = canvas.width;
        const height = canvas.height;
        const range = getRange(profiler.lastData);
        const scale = profiler.scale;
        const offset = profiler.offset;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawThreads(context, threadInfos, threadHeights, stringIndex, range, scale, offset, lastData, {width, height, drawGridLines: true, drawThreadHeaders: true});
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
