/** @babel */

import * as Rx from 'rx';
import * as process from 'process';
import * as child_process from 'child_process';
import {createSocketStream} from './console-connection';

const url = "ws://localhost:14032";
let processId = process.pid.toString();

function isAssetServerResponding() {
    const socket = createSocketStream(url,
        observer => observer.onNext(JSON.stringify({
            type: "is-asset-server-running",
            id: processId
        }))
    );

    const isResponding = new Rx.Subject();

    socket
        .filter(x => typeof(x.data) === "string")
        .map(x => JSON.parse(x.data))
        .filter(x => x["id"] === processId)
        .subscribe(x => {
                isResponding.onNext(true);
                isResponding.onCompleted();
                socket.onCompleted();
            },
            isResponding.onError.bind(isResponding),
            isResponding.onCompleted.bind(isResponding));

    return isResponding.timeout(1000, "Asset server timeout");
}

export class AssetServer {
    static ensureRunning(executable) {
        isAssetServerResponding().subscribe(
            x => {console.log("Asset server already running -- doing nothing.");},
            e => {
                console.log("Asset server not responding -- launching");
                child_process.spawn(executable, ["--asset-server"]);
            }
        );
    }
};
