/** @babel */

import fs from 'fs';
import path from 'path';
import {Buffer} from 'buffer';
import * as Rx from 'rx';

import {SJSON} from './sjson';
import {Project} from './project';
import {createSocketStream} from './console-connection';

const EDITOR_CHANNEL_PORT = 12010;
const EDITOR_MARSHALLING_NAMESPACE = "Stingray.Core.Marshalling";
const EDITOR_INIT_REMOTE_OBJECT_TYPE = "InitializeRemoteObject";
const EDITOR_PROJECT_SERVICE_NAME = "Stingray.Foundation.ProjectService";

// Stingray remove object creation message format.
// {
//      "namespace":"Stingray.Core.Marshalling",
//      "type":"InitializeRemoteObject",
//      "data": { 
//          "ids": [
//              {"name":"Stingray.Foundation.ProjectService"}
//          ],
//          "callbackId":0
//      }
// }

let callbackId = 0;

const readFile = Rx.Observable.fromNodeCallback(fs.readFile);

export function runningToolchainPath() {
    const cid = callbackId++;
    const socket = createSocketStream(`ws://localhost:${EDITOR_CHANNEL_PORT}?namespaces=${EDITOR_MARSHALLING_NAMESPACE}`,
        observer => observer.onNext(JSON.stringify({
            namespace: EDITOR_MARSHALLING_NAMESPACE,
            type: EDITOR_INIT_REMOTE_OBJECT_TYPE,
            data: {
                ids: [{name: EDITOR_PROJECT_SERVICE_NAME}],
                callbackId: cid
            }
        })));
        
    const paths = new Rx.Subject();
    
    socket
        .filter(x => typeof(x.data) === "string")
        .map(x => JSON.parse(x.data))
        .filter(x => x.data.callbackId === cid && x.type === "RequestResponse")
        .map(x => x.data.result.remoteObjects[0].value)
        .filter(x => x !== undefined)
        .subscribe(x => {
                paths.onNext(x.ToolChainDirectory);
                paths.onCompleted();
                socket.onCompleted();
            },
            paths.onError.bind(paths),
            paths.onCompleted.bind(paths));
        
    return paths.timeout(200, Rx.Observable.return(preferredToolchainPath()));
}

export function preferredToolchainPath() {
    return atom.config.get('stingray.toolchainPath') || process.env.SR_BIN_DIR;
}

export function configuration(toolchainPath) {
    return readFile(path.join(toolchainPath, "settings", "ToolChainConfiguration.config"))
        .map(SJSON.parse);
}

export function sourceRepositoryPath(config) {
    return Rx.Observable.return(config.SourceRepositoryPath);
    return config.SourceRepositoryPath !== undefined
        ? Rx.Observable.return(config.SourceRepositoryPath)
        : Rx.Observable.throw(new Error("Toolchain doesn't have a source repository configured."));
}

export function projects(configuration) {
    return Rx.Observable.return(configuration)
        .flatMap(x => x.Projects || [])
        .map(json => ({
            id: json.Id,
            name: json.Name,
            sourceDirectory: json.SourceDirectory,
            dataDirectory: json.DataDirectoryBase
        }));
}
