/** @babel */

// import {Rx} from 'rxjs-es6/Rx';

const url = "ws://localhost:14032"

static isAssetServerResponding() {
    var p = new Promise(
        function (resolve, reject) {
            var socket = new WebSocket(url);
            socket.onopen = function (evt) {
                resolve(true);
                socket.close();
            }
            socket.onerror = function (evt) {
                resolve(false);
            }
        }
    );
    return p;
}

export class AssetServer {
    static ensureRunning(executable) {
        isAssetServerResponding().then(
            function (val) {
                if (val)
                    console.log("Asset server already running -- doing nothing.");
                else {
                    console.log("Asset server not responding -- launching");
                    child_process.spawn(executable, ["--asset-server"])
                }
            }
        )
    }
};
