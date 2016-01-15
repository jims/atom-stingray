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

    return isResponding.timeout(1000, "Asset server timeout");
}

export function ensureRunning(executable) {
    return Rx.Observable.create(observer => {
        isAssetServerResponding().subscribe(
            x => {observer.onNext();},
            e => {
                console.log("Asset server not responding -- launching");
                let child = child_process.spawn(executable, ["--asset-server"]);
                isAssetServerResponding().subscribe(
                    x => {observer.onNext();},
                    e => {
                        child.kill();
                        observer.onError("Asset server does not respond to web socket protocol (you need Stingray >=1.3).");
                    }
                )
            }
        );
    });
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
    const result = Rx.Observable.create(observer => {
        ensureRunning(o.executable).subscribe(
            x => {
                const request = makeCompileRequest(o);
                const connection = createConsoleConnection(url);

                let isCompiling = false;
                let errors = [];

                const subscription = connection
                    .subscribe(
                        x => {
                            if (x.type === "compiler" && x.id === request.id) {
                                isCompiling |= x.start;
                                if (!x.finished)
                                    return;

                                if (x.status !== "success")
                                    observer.onError(errors);

                                observer.onNext({type: "project", project: o});
                                observer.onCompleted();
                            }

                            if (!isCompiling)
                                return;

                            if (x.type === "compile_progress")
                                observer.onNext({type: "progress", progress: x.i, total: x.count, file: x.file});
                            if (x.type === "compiling_files")
                                observer.onNext({type: "files", files: x.files});
                            else if (x.type === "message" && x.level === "error")
                                errors.push(x);
                            else if (x.type === "compile_response" && x.response_type === "shader_compile_error") {
                                x.decorated_message = `${x.compiler_file}:${x.compiler_line}> ${x.compiler_output}`;
                                errors.push(x);
                            }
                        },
                        e => observer.onError(e),
                        () => observer.onCompleted());

                connection.onNext(JSON.stringify(request));
                return () => subscription.dispose();
            },
            e => observer.onError(e)
        );
    });

    return result;
}

export function formatCompileError(e)
{
    return e["decorated_message"]
}
