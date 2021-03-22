# Nico for Visual Studio Code

[The VS Code Nico extension](https://github.com/ishikawa/vscode-nico) provides _hopefully rich_ language support for [the Nico programming language](https://github.com/ishikawa/nico).

## Functionality

Not so much. It's under heavy development now.

## Running

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press `Ctrl+Shift+B` to compile the client.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'Nico' language mode.
  - Type `j` or `t` to see `Javascript` and `TypeScript` completion.
  - Enter text content such as `AAA aaa BBB`. The extension will emit diagnostics for all words in all-uppercase.
