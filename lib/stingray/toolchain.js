/** @babel */

export class Toolchain {
    static get currentToolchain() {
        return atom.config.get('stingray.toolchainPath') || process.env.SR_BIN_DIR;
    }
};
