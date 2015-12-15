/** @babel */

import * as Rx from 'rx';
import * as Guid from 'guid';
import * as child_process from 'child_process';
import {create as createConsoleConnection} from './console-connection';

const url = "ws://localhost:14032";
let processId = process.pid.toString();

function isAssetServerResponding() {
    const isResponding = Rx.Observable.create(observer => {
        const id = Guid.raw();
        const resolve = () => {
            observer.onNext(true);
            observer.onCompleted();
        };
        
        const connection = createConsoleConnection(url);
        const subscription = connection
            .filter(x => x.id === id)
            .subscribe(resolve, err => observer.onError(err), () => observer.onCompleted());
            
        connection.onNext(JSON.stringify({
            type: "is-asset-server-running",
            id: id
        }));

        return () => subscription.dispose();
    });

    return isResponding.timeout(200, "Asset server timeout");
}

export function ensureRunning(executable) {
    isAssetServerResponding().subscribe(
        x => {},
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

    const socket = createSocketStream(url);

    var result = new Rx.Subject();

    // TODO: Moar reactive -- maybe we do not want to subscribe here.

    var isCompiling = false;
    var errors = [];
    socket
        .filter(x => typeof(x.data) === "string")
        .map(x => JSON.parse(x.data))
        .subscribe(
            x => {
                if (x["type"] === "compiler" && x["id"] === request.id && x["start"]) {
                    isCompiling = true;
                }
                if (x["type"] === "message" && x["level"] === "error" && isCompiling) {
                    errors.push(x)
                }
                if (x["type"] === "compiler" && x["id"] == request.id && x["finished"]) {
                    if (x["status"] == "success")
                        result.onNext(o);
                    else
                        result.onError(errors);
                    socket.onCompleted();
                    result.onCompleted();
                }
            },
            e => {result.onError(e);},
            c => {result.onCompleted(c);}
        );

    socket.onNext(JSON.stringify(request));

    return result;
}

export function formatCompileErrors(e)
{
    return e.map(x => x["decorated_message"]).join("\n\n")
}
