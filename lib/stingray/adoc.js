/** @babel */

import fs from 'fs';
import path from 'path';
import * as Rx from 'rx';

const readFile = Rx.Observable.fromNodeCallback(fs.readFile);
export function adoc(binDir) {
  return Rx.Observable.just(binDir)
    .map(x => path.join(x, "editor", "resources", "lua_api_stingray3d.json"))
    .flatMap(x => readFile(x))
    .map(x => JSON.parse(x));
}
