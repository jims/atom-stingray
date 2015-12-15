/** @babel */

import * as Rx from 'rx';

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
