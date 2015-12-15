/** @babel */

import * as Rx from "rx";
import {Socket} from "net";

export function observableFromWebSocket(ws) {
    const observer = Rx.Observer.create(ws.send.bind(ws));
    const observable = Rx.Observable.create(o => {
        ws.binaryType = "arraybuffer";
        ws.onmessage = o.onNext.bind(o);
        ws.onerror = o.onError.bind(o);
        ws.onclose = o.onCompleted.bind(o);
        return ws.close.bind(ws);
    });
    return Rx.Subject.create(observer, observable);
}

export function createSocketStream(url, onOpen) {
    const ws = new WebSocket(url);
    const subj = observableFromWebSocket(ws);
    ws.onopen = onOpen.bind(null, subj);
    return subj;
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
            socket.setTimeout(50, () => handlePortClosed(socket, port));
            socket.connect(port, "localhost");
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
