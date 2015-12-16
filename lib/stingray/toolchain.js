/** @babel */

import fs from 'fs';
import path from 'path';
import {Buffer} from 'buffer';
import * as Rx from 'rx';

import {SJSON} from './sjson';
import {Project} from './project';
import * as ConsoleConnection from './console-connection';

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
export function runningToolchainPath() {
    const runningPath = Rx.Observable.create(observer => {
        const cid = callbackId++;
        
        const connection = ConsoleConnection.create(`ws://localhost:${EDITOR_CHANNEL_PORT}?namespaces=${EDITOR_MARSHALLING_NAMESPACE}`);
        const subscription = connection
            .filter(x => x.data.callbackId === cid && x.type === "RequestResponse")
            .map(x => x.data.result.remoteObjects[0].value)
            .filter(x => x !== undefined)
            .subscribe(x => {
                    observer.onNext(x.ToolChainDirectory);
                    observer.onCompleted();
                },
                e => observer.onError(e),
                () => observer.onCompleted());
                
        connection.onNext(JSON.stringify({
            namespace: EDITOR_MARSHALLING_NAMESPACE,
            type: EDITOR_INIT_REMOTE_OBJECT_TYPE,
            data: {
                ids: [{name: EDITOR_PROJECT_SERVICE_NAME}],
                callbackId: cid
            }
        }));
        
        return () => subscription.dispose();
    });

    return runningPath.timeout(100, Rx.Observable.return(preferredToolchainPath()));
}

export function preferredToolchainPath() {
    return atom.config.get('stingray.toolchainPath') || process.env.SR_BIN_DIR;
}

const readFile = Rx.Observable.fromNodeCallback(fs.readFile);
export function configuration(toolchainPath) {
    return readFile(path.join(toolchainPath, "settings", "ToolChainConfiguration.config"))
        .map(SJSON.parse)
        .map(x => ({path: toolchainPath, json: x}));
}

export function sourceRepositoryPath(config) {
    if (config.json.SourceRepositoryPath === undefined)
        throw new Error("The toolchain doesn't have a source repository configured.");

    return config.json.SourceRepositoryPath;
}

function toolchainPath(config) {
    return config.path;
}
export { toolchainPath as path };

export function targets(config) {
    return Rx.Observable.return(config)
        .flatMap(x => x.json.Targets || [])
        .map(json => ({
            id: json.Id,
            name: json.Name,
            host: json.Ip,
            commandLine: json.CommandLine,
            platform: json.Platform,
            port: (json.Platform || "win32") === "xb1" ? ConsoleConnection.XB1_PORT : ConsoleConnection.PORT
        }));
}

export function buildType(config) {
    if (config.json.Build === undefined)
        throw new Error("The toolchain doesn't have a build type specified");
    
    return config.json.Build;
}

export function projects(config) {
    return Rx.Observable.return(config)
        .flatMap(x => x.json.Projects || [])
        .map(json => ({
            id: json.Id,
            name: json.Name,
            sourceDirectory: json.SourceDirectory,
            dataDirectory: json.DataDirectoryBase
        }));
}

export function assetServerExecutable(config) {
    const build = buildType(config);
    return path.join(toolchainPath(config), "engine", "win64", build, `stingray_win64_${build}_x64.exe`)
}

export function runtimeExecutable(config) {
    const build = buildType(config);
    return path.join(toolchainPath(config), "engine", "win64", build, `stingray_win64_${build}_x64.exe`)
}
