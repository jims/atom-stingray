/** @babel */

import fs from 'fs';
import path from 'path';
import {Buffer} from 'buffer';
import * as Rx from 'rxjs-es6/Rx';

import {SJSON} from './sjson';
import {Project} from './project';

const EDITOR_CHANNEL_PORT = 12010;
const EDITOR_MARSHALLING_NAMESPACE = "Stingray.Core.Marshalling";
const EDITOR_INIT_REMOTE_OBJECT_TYPE = "InitializeRemoteObject";
const EDITOR_PROJECT_SERVICE_NAME = "Stingray.Foundation.ProjectService";

// {
//      "namespace":"Stingray.Core.Marshalling",
//      "type":"InitializeRemoteObject",
//      "data": { 
//          "ids": [
//              {"name":"Stingray.Foundation.FileSystemService"}
//          ],
//          "callbackId":0
//      }
// }

const createSocketStream = (url, onOpen) => {
    const ws = new WebSocket(url);
    const input = { next: ws.send.bind(ws) };
    const output = Rx.Observable.create(o => {
        ws.binaryType = "arraybuffer";
        ws.onmessage = o.next.bind(o);
        ws.onerror = o.error.bind(o);
        ws.onclose = o.complete.bind(o);
        ws.onopen = onOpen.bind(null, input);
        return ws.close.bind(ws);
    });
    return Rx.Subject.create(output, input);
}

let callbackId = 0;

export class Toolchain {    
    static get runningToolchainPath() {
        const cid = callbackId++;
        const socket = createSocketStream(`ws://localhost:${EDITOR_CHANNEL_PORT}?namespaces=${EDITOR_MARSHALLING_NAMESPACE}`,
            o => o.next(JSON.stringify({
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
                    paths.next(x.ToolChainDirectory);
                    paths.complete();
                    socket.complete();
                },
                paths.error.bind(paths),
                paths.complete.bind(paths));
            
        return paths.timeoutWith(1000, Rx.Observable.of(Toolchain.preferredToolchainPath));
    }
    
    static get preferredToolchainPath() {
        return atom.config.get('stingray.toolchainPath') || process.env.SR_BIN_DIR;
    }
    
    static setCurrentToolchain(path) {
        
    }
    
    constructor(path) {
        
    }
    
    get projects() {
        const json = fs.readFileSync(path.join(toolchain, "settings", "ToolChainConfiguration.config"));
        const config = SJSON.parse(json);
        return rx.Observable.from(config.Projects.map(p => new Project(p)));
        return this.projects;
    }
    
    get project() {
        return this.project;
    }
};
