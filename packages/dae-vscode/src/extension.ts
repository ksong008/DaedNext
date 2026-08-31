/**
 * DAE Language Extension for VS Code
 *
 * This extension provides language support for DAE configuration files
 * by connecting to the dae-lsp language server.
 */

import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'

const LANGUAGE_ID = 'dae'
let client: LanguageClient | undefined

export async function activate(context: vscode.ExtensionContext) {
  const serverModule = path.join(context.extensionPath, 'dist', 'server', 'server.cjs')

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  }

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.dae')
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: LANGUAGE_ID },
      { scheme: 'untitled', language: LANGUAGE_ID },
    ],
    synchronize: {
      fileEvents: fileWatcher,
    },
  }
  context.subscriptions.push(fileWatcher)

  client = new LanguageClient('dae-language-server', 'DAE Language Server', serverOptions, clientOptions)

  try {
    await client.start()
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start DAE Language Server: ${error}`)
    return
  }

  context.subscriptions.push(client)
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop()
  }
}
