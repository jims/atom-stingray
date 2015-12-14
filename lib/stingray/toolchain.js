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

const createSocketStream = url => {
    const ws = new WebSocket(url);
    const output = Rx.Observer.create(ws.send.bind(ws));
    const input = Rx.Observable.create(o => {
        ws.binaryType = "arraybuffer";
        ws.onmessage = o.next.bind(o);
        ws.onerror = o.error.bind(o);
        ws.onclose = o.complete.bind(o);
        return ws.close.bind(ws);
    });
    return Rx.Subject.create(output, input);
}

export class Toolchain {    
    static get runningToolchainPath() {            
        const socket = createSocketStream(`ws://localhost:${EDITOR_CHANNEL_PORT}?namespaces=${EDITOR_MARSHALLING_NAMESPACE}`);
        const paths = new Rx.Subject();
    
        socket
            .filter(x => typeof(x.data) === "string")
            .map(x => JSON.parse(x.data))
            .filter(x => x.remoteObjects[0] !== undefined)
            .map(x => x.remoteObjects[0])
            .subscribe(x => {
                    console.log(x);
                    paths.next(x.ToolchainDirectory);
                    socket.complete();
                },
                paths.error.bind(paths),
                paths.complete.bind(paths));        
        
        socket.next(JSON.stringify({
            namespace: EDITOR_MARSHALLING_NAMESPACE,
            type: EDITOR_INIT_REMOTE_OBJECT_TYPE,
            data: { ids: [{name: EDITOR_PROJECT_SERVICE_NAME}] },
            callbackId: Math.random(Math.log10())
        }));
            
        return paths;//.timeoutWith(1, Rx.Observable.of(Toolchain.preferredToolchainPath));
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
