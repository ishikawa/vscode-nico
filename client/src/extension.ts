/* --------------------------------------------------------------------------------------------
 * This client extension is based on microsoft/vscode-extension-samples.
 * https://github.com/microsoft/vscode-extension-samples
 *
 * License of microsoft/vscode-extension-samples
 * ---------------------------------------------
 * Copyright (c) Microsoft Corporation
 *
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
 * OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * ------------------------------------------------------------------------------------------ */
import * as path from 'path';
import * as fs from 'fs';
import {
  workspace as Workspace,
  window as Window,
  ExtensionContext,
  TextDocument,
  OutputChannel,
  WorkspaceFolder,
  Uri
} from 'vscode';

import { Executable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient/node';

const CLIENT_ID = 'nico';

const CLIENT_NAME = 'Nico';

const LANGUAGE_ID = 'nico';

// The default client for an untitled document.
let defaultClient: LanguageClient;

const clients: Map<string, LanguageClient> = new Map();

let _sortedWorkspaceFolders: string[] | undefined;
function sortedWorkspaceFolders(): string[] {
  if (_sortedWorkspaceFolders === void 0) {
    _sortedWorkspaceFolders = Workspace.workspaceFolders
      ? Workspace.workspaceFolders
          .map(folder => {
            let result = folder.uri.toString();
            if (result.charAt(result.length - 1) !== '/') {
              result = result + '/';
            }
            return result;
          })
          .sort((a, b) => {
            return a.length - b.length;
          })
      : [];
  }
  return _sortedWorkspaceFolders;
}

Workspace.onDidChangeWorkspaceFolders(() => (_sortedWorkspaceFolders = undefined));

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
  const sorted = sortedWorkspaceFolders();
  for (const element of sorted) {
    let uri = folder.uri.toString();
    if (uri.charAt(uri.length - 1) !== '/') {
      uri = uri + '/';
    }
    if (uri.startsWith(element)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Workspace.getWorkspaceFolder(Uri.parse(element))!;
    }
  }
  return folder;
}

export function activate(context: ExtensionContext): void {
  const outputChannel: OutputChannel = Window.createOutputChannel(CLIENT_ID);
  const traceOutputChannel: OutputChannel = Window.createOutputChannel(`${CLIENT_ID}-trace`);

  const serverPath = context.asAbsolutePath(path.join('..', 'nico', 'target', 'debug', 'nico-ls'));

  if (!fs.existsSync(serverPath)) {
    throw new Error(`No language server at ${serverPath}`);
  }

  const serverOptions: Executable = {
    command: serverPath,
    args: [],
    options: {
      env: {
        RUST_LOG: 'info',
        RUST_BACKTRACE: 'full'
      }
    }
  };

  function didOpenTextDocument(document: TextDocument): void {
    // We are only interested in language mode text
    if (
      document.languageId !== LANGUAGE_ID ||
      (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')
    ) {
      return;
    }

    const uri = document.uri;

    // Untitled files go to a default client.
    if (uri.scheme === 'untitled' && !defaultClient) {
      const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'untitled', language: LANGUAGE_ID }],
        diagnosticCollectionName: CLIENT_ID,
        outputChannel,
        traceOutputChannel
      };
      defaultClient = new LanguageClient(CLIENT_ID, CLIENT_NAME, serverOptions, clientOptions);
      defaultClient.start();
      return;
    }

    let folder = Workspace.getWorkspaceFolder(uri);

    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) {
      return;
    }

    // If we have nested workspace folders we only start a server on the outer most workspace folder.
    folder = getOuterMostWorkspaceFolder(folder);

    if (!clients.has(folder.uri.toString())) {
      const clientOptions: LanguageClientOptions = {
        documentSelector: [
          {
            scheme: 'file',
            language: LANGUAGE_ID,
            pattern: `${folder.uri.fsPath}/**/*`
          }
        ],
        diagnosticCollectionName: CLIENT_ID,
        workspaceFolder: folder,
        outputChannel,
        traceOutputChannel
      };

      const client = new LanguageClient(CLIENT_ID, CLIENT_NAME, serverOptions, clientOptions);

      client.start();
      clients.set(folder.uri.toString(), client);
    }
  }

  Workspace.onDidOpenTextDocument(didOpenTextDocument);
  Workspace.textDocuments.forEach(didOpenTextDocument);
  Workspace.onDidChangeWorkspaceFolders(event => {
    for (const folder of event.removed) {
      const client = clients.get(folder.uri.toString());
      if (client) {
        clients.delete(folder.uri.toString());
        client.stop();
      }
    }
  });
}

export async function deactivate(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (defaultClient) {
    promises.push(defaultClient.stop());
  }
  for (const client of clients.values()) {
    promises.push(client.stop());
  }
  await Promise.all(promises);
  return undefined;
}
