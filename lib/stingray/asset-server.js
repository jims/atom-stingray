/** @babel */

import * as Rx from 'rx';
import * as Guid from 'guid';
import * as child_process from 'child_process';
import {createSocketStream} from './console-connection';

const url = "ws://localhost:14032";
let processId = process.pid.toString();

function isAssetServerResponding() {
    const id = Guid.raw();

    const socket = createSocketStream(url,
        observer => observer.onNext(JSON.stringify({
            type: "is-asset-server-running",
            id: id
        }))
    );

    const isResponding = new Rx.Subject();

    socket
        .filter(x => typeof(x.data) === "string")
        .map(x => JSON.parse(x.data))
        .filter(x => x["id"] === id)
        .subscribe(x => {
                isResponding.onNext(true);
                isResponding.onCompleted();
                socket.onCompleted();
            },
            isResponding.onError.bind(isResponding),
            isResponding.onCompleted.bind(isResponding));

    return isResponding.timeout(1000, "Asset server timeout");
}

export function ensureRunning(executable) {
    isAssetServerResponding().subscribe(
        x => {console.log("Asset server already running -- doing nothing.");},
        e => {
            console.log("Asset server not responding -- launching");
            child_process.spawn(executable, ["--asset-server"]);
        }
    );
}

function makeCompileRequest(o) {
    return {
        id: Guid.raw(),
        type: "compile",
        "source-directory": o.sourceDir,
        "source-directory-maps": [
            {
                directory: "core",
                root: o.coreRoot
            }
        ],
        "data-directory": o.dataDir,
        platform: "win32"
    }
}

export function compile(o) {
    ensureRunning(o.executable);

    let request = makeCompileRequest(o);

    const socket = createSocketStream(url, observer => observer.onNext(
        JSON.stringify(request)
    ));

    var result = new Rx.Subject();

    // TODO: Moar reactive -- maybe we do not want to subscribe here.

    socket
        .filter(x => typeof(x.data) == "string")
        .map(x => JSON.parse(x.data))
        .filter(x => x["id"] === request.id)
        .filter(x => x["type"] == "compiler")
        .subscribe(
            x => {
                if (x["finished"]) {
                    result.onNext(x["status"] == "success")
                    // TODO: We probably want to unsubscribe from the socket here -- how?
                }
            },
            e => {result.onError(e);},
            c => {result.onCompleted(c);}
        )

    return result;
}
