/** @babel */

import * as Rx from "rx";
import {Socket} from "net";

export const PORT = 14030;
export const XB1_PORT = 4601;

export function createSocketStream(url) {
    let socket = null;
    let bufferedMessages = [];

    // Buffer messages until a connection has been made.
    const observer = Rx.Observer.create(msg => {
            if (socket != null && socket.readyState === WebSocket.OPEN)
                socket.send(msg);
            else
                bufferedMessages.push(msg);
        },
        e => {},
        // Find a way to flush output here...
        () => {
            if (socket != null)
                socket.close()
        });

    const observable = Rx.Observable.create(o => {
        socket = new WebSocket(url);
        socket.binaryType = "arraybuffer";
        
        // FLush buffered messages on connect.
        socket.onopen = () => {
            for (let i = bufferedMessages.length-1; i >= 0; --i)
                socket.send(bufferedMessages[i]);
    
            bufferedMessages = null;
        };
        
        socket.onmessage = o.onNext.bind(o);
        socket.onerror = () => o.onError(new Error("Unknown socket error."));
        socket.onclose = e => {
            // CLOSE_NORMAL,  CLOSE_ABNORMAL or CLOSE_NO_STATUS
            if (e.code == 1000 || e.code == 1006 || e.code == 1005)
                o.onCompleted();
            else
                o.onError(new Error(`Socket Exception '${e.code}': ${e.reason}`));
        };
        return () => socket.close();
    });

    return Rx.Subject.create(observer, observable.share());
}

export function filterSubject(subj, filter) {
    const filteredSubject = filter(subj);
    return Rx.Subject.create(
        Rx.Observer.create(
            x => subj.onNext(x),
            e => subj.onErorr(e),
            () => subj.onCompleted()),
        filteredSubject);
}

export function create(url) {
    return filterSubject(
        createSocketStream(url),
        stream => stream
            .filter(x => typeof(x.data) === "string")
            .map(x => JSON.parse(x.data)));
}

export function isPortOpen(value, host, port) {
    return Rx.Observable.create(observer => {
        const socket = new Socket();
        socket.on("connect", () => observer.onNext(value));
        socket.on("error", err => socket.destroy());
        socket.setTimeout(500, () => socket.destroy());
        socket.connect(port, host);
        return () => socket.destroy();
    });
}

export function observableOfOpenPorts(startPort, endPort) {
    if (endPort === undefined)
        endPort = startPort;

    console.assert(startPort <= endPort);
    const observers = [];
    const scanInProgressPorts = new Set();
    const knownOpenPorts = new Set();
    let pollHandle = null;

    const reportPortStatusChange = (observer, port, status) => {
        console.assert(typeof(port) === "number" && (port % 1) === 0);
        console.assert(status === "opened" || status === "closed");
        observer.onNext({port, status});
    }

    const handlePortOpened = (socket, port) => {
        scanInProgressPorts.delete(port);
        socket.destroy();

        if (knownOpenPorts.has(port))
            return;

        for (let observer of observers)
            reportPortStatusChange(observer, port, "opened");

        knownOpenPorts.add(port);
    };

    const handlePortClosed = (socket, port) => {
        scanInProgressPorts.delete(port);
        socket.destroy();

        if (!knownOpenPorts.delete(port))
            return;

        for (let observer of observers)
            reportPortStatusChange(observer, port, "closed");
    };

    const poll = () => {
        for (let port = startPort; port <= endPort; ++port) {
            if (scanInProgressPorts.has(port))
                continue;

            scanInProgressPorts.add(port);
            const socket = new Socket();
            socket.on("connect", () => handlePortOpened(socket, port));
            socket.on("error", err => handlePortClosed(socket, port));
            socket.setTimeout(500, () => handlePortClosed(socket, port));
            socket.connect(port, "127.0.0.1");
        }
    };

    const observable = Rx.Observable.create(observer => {
        observers.push(observer);

        for (let port of knownOpenPorts)
            reportPortStatusChange(observer, port, "opened");

        if (observers.length == 1)
            pollHandle = setInterval(poll, 1000);

        return () => {
            // Remove from list of observers.
            const index = observers.indexOf(observer);
            console.assert(index >= 0);
            observers.splice(index, 1);

            // Stop polling if we're the last observer.
            if (observers.length === 0) {
                clearTimeout(pollHandle);
                pollHandle = null;
            }
        };
    });

    return observable;
}

export function encodeCommand(command) {
    const parts = command.split(' ');
    return JSON.stringify({
        type: "command",
        command: parts[0],
        arg: parts.slice(1)
    })
}

export function encodeLua(lua) {
    return JSON.stringify({
        type: "script",
        script: lua
    })
}
