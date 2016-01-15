# Atom package for Stingray

This package provides a number of features that integrates Atom
with the Stingray game engine.

The features that depend on communication with the Stingray engine require
the Stingray WebSocket interface, which is currently only available in the
development branch of Stingray (which will eventually be released as Stingray
1.3). That means they won't work with the current binary releases of Stingray.
Feature compatibility is shown in the list below:

* SJSON syntax highlighting (Stingray 1.1)
* Stingray Lua API help (Stingray 1.1)
* Auto-complete for Lua API and resource paths (Stingray 1.1)
* Navigate between resources (Stingray 1.1)
* Launch Stingray project and hot reload content (Stingray 1.3)
* Lua REPL console integrated into Atom (Stingray 1.3)

Most of these features are available through the *Stingray* menu
added by the package.

## Features

### SJSON Syntax Highlighting

Stingray uses a "more human readable" format of JSON called SJSON.
The Stingray package provides SJSON syntax highlighting for
Stingray resource files, such as `.level`, `.unit`, etc.

The syntax package also provides HLSL syntax high lighting for
resource shaders, using the shader syntax from [sublime-shaders](https://github.com/noct/sublime-shaders).

### Stingray Lua API Help

Press `F1` to bring up the Adoc help for the Stingray Lua API
function located under your cursor.

![](docs/help-selection.gif)

Press `Shift-F1` to bring up a dialog box that allows you to search among all the help files.

![](docs/help.gif)

### Auto-complete for Lua API and Stingray resource paths

As you type Lua API functions and Stingray resource paths, the Stingray
plugin will offer autocomplete suggestions.

![](docs/autocomplete.gif)

### Navigate between resources

With the cursor in a Stingray resource path you can quick-jump to the
resource.

![](docs/go-to-resource.gif)

### Launch stingray projects and hot-reload content

You can launch Stingray projects directly from atom by choosing
`Run Project`. Atom will locate your current project by reading
the settings file in your toolchain folder (located by the `$SR_BIN_DIR`
variable).

If you just want to check that your data compiles without actually
launching the project, you can use the `Compile` menu
option.

With the project running there are several ways of hot-reloading
project content. `Refresh` tells the engine to reload all changed files.

If you are just working in Lua, you can use `Execute Buffer` to
run the Lua file you are currently editing. This will effective hot-reload
that file. You can also use `Execute Selection` to run just the
Lua code that you have currently selected.

![](docs/refresh.gif)

### Lua REPL console integrated into Atom

`Toggle Console` shows the Lua REPL that allows you to communicate
with the running Lua engine. Output from the engine will be printed
to the console and you can write Lua code directly into the console.

![](docs/repl.gif)

## Settings

For the plugin to find your Stingray settings and executables it must be able
to locate your Stingray installation. There are three ways of doing this:

* If the editor is already running, the plugin will connect to the running
editor and talk to it to find out the installation directory. (This only works
in Stingray 1.3.)

* Otherwise, the plugin will look for an Atom setting called `stingray.toolchainPath`
that should point to your Stingray toolchain directory. That is the top level
Stingray directory which has subdirectories called `core`, `editor`, `engine`,
etc.

* If that setting has not been set, the plugin will read the installation directory
from the environment variable `SR_BIN_DIR`.

If neither of these options work, the plugin will not be able to find your
Stingray installation and will run in offline mode.
