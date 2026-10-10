import type { Connection, SemanticTokens, TextDocuments } from 'vscode-languageserver'
import { expect, it } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { initializeServer } from '../src/server-core'

it('reuses semantic tokens until edit, close or LRU eviction', () => {
  const open = new Map<string, TextDocument>()
  let semantic!: (params: { textDocument: { uri: string } }) => SemanticTokens
  let close!: (event: { document: TextDocument }) => void
  const noop = () => {}
  const connection = new Proxy(
    {
      console: { log: noop },
      languages: {
        semanticTokens: {
          on: (handler: typeof semantic) => {
            semantic = handler
          },
        },
      },
    },
    { get: (target, property) => Reflect.get(target, property) ?? noop },
  )
  const documents = {
    get: (uri: string) => open.get(uri),
    onDidChangeContent: noop,
    onDidClose: (handler: typeof close) => {
      close = handler
    },
    listen: noop,
  }
  initializeServer(connection as unknown as Connection, documents as unknown as TextDocuments<TextDocument>)
  const uri = 'file:///test.dae'
  open.set(uri, TextDocument.create(uri, 'routingA', 1, 'routing {\n dport(443) -> proxy\n}'))
  const read = (documentUri = uri) => semantic({ textDocument: { uri: documentUri } })
  const first = read()
  expect(first.data.length).toBeGreaterThan(0)
  expect(read()).toBe(first)
  open.set(uri, TextDocument.create(uri, 'routingA', 2, '# edited'))
  const edited = read()
  expect(edited.data).not.toEqual(first.data)
  expect(read()).toBe(edited)
  for (let i = 0; i < 128; i++) {
    const otherUri = `file:///other-${i}.dae`
    open.set(otherUri, TextDocument.create(otherUri, 'routingA', 1, '# comment'))
    read(otherUri)
    if (i === 126) expect(read()).toBe(edited)
  }
  expect(read()).toBe(edited)
  close({ document: open.get(uri)! })
  open.set(uri, TextDocument.create(uri, 'routingA', 2, '# reopened'))
  expect(read()).not.toBe(edited)
})
