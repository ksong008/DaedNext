import type { Monaco } from '@monaco-editor/react'
import type * as monacoEditor from 'monaco-editor'
import type { RoutingCompletionItem } from '~/editor_completions'
import {
  applyShikiThemes as applyShikiThemesBase,
  DiagnosticSeverity,
  formatRoutingA,
  GITHUB_THEMES,
  initShikiHighlighter,
  isShikiReady,
  MonacoLspClient,
  registerRoutingALanguage,
  setDynamicCompletionItems as setDynamicCompletionItemsBase,
  SHIKI_THEMES,
} from '@daeuniverse/dae-editor'
// Import the browser LSP server worker
import DaeLspWorker from '@daeuniverse/dae-lsp/server/browser?worker'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { getDynamicCompletionItems } from '~/editor_completions'
import { registerPageRetireHandler } from '~/page_lifecycle'
import 'monaco-editor/esm/vs/editor/editor.all.js'

const DNS_COMMENT_RE = /#[^\n]*/
const DNS_SINGLE_QUOTED_STRING_RE = /'[^']*'/
const DNS_DOUBLE_QUOTED_STRING_RE = /"[^"]*"/
const DNS_CONTROL_KEYWORD_RE = /\b(upstream|routing|request|response|fallback|accept|reject|asis)\b/
const DNS_MATCH_KEYWORD_RE = /\b(qname|qtype|rcode|qclass)\b/
const DNS_RESOURCE_TYPE_RE = /\b(geosite|geoip)\b/
const DNS_BRACKET_RE = /[{}()]/
const DNS_ARROW_RE = /->/
const DNS_DELIMITER_RE = /:/
const DNS_IDENTIFIER_RE = /[\w.-]+/
const DNS_WHITESPACE_RE = /\s+/

// Configure Monaco workers for Vite
globalThis.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  },
}

// Configure loader to use local monaco-editor package
loader.config({ monaco })

// LSP Client instance (singleton)
let lspClient: MonacoLspClient | null = null
let lspInitialized = false
let lspOwners = 0
let lspInitialization: Promise<void> | null = null
let lspGeneration = 0
const ownedModelUris = new Set<string>()

// Cache for dynamic completion items (set before LSP client is initialized)
let pendingDynamicCompletionItems: RoutingCompletionItem[] = getDynamicCompletionItems()

// Re-export from @daeuniverse/dae-editor
export { formatRoutingA, GITHUB_THEMES, initShikiHighlighter, isShikiReady, SHIKI_THEMES }

/**
 * Register a lightweight DNS config language for Monaco.
 * dae-editor currently only ships routingA, so we define dnsA here for syntax highlighting.
 */
function registerDnsALanguage(monacoInstance: Monaco): void {
  const id = 'dnsA'
  // Avoid double registration
  if ((monacoInstance.languages as any).getLanguages?.().some((l: any) => l.id === id)) return

  monacoInstance.languages.register({ id })
  monacoInstance.languages.setMonarchTokensProvider(id, {
    tokenizer: {
      root: [
        [DNS_COMMENT_RE, 'comment'],
        [DNS_SINGLE_QUOTED_STRING_RE, 'string'],
        [DNS_DOUBLE_QUOTED_STRING_RE, 'string'],
        [DNS_CONTROL_KEYWORD_RE, 'keyword'],
        [DNS_MATCH_KEYWORD_RE, 'keyword'],
        [DNS_RESOURCE_TYPE_RE, 'type.identifier'],
        [DNS_BRACKET_RE, '@brackets'],
        [DNS_ARROW_RE, 'operator'],
        [DNS_DELIMITER_RE, 'delimiter'],
        [DNS_IDENTIFIER_RE, 'identifier'],
        [DNS_WHITESPACE_RE, 'white'],
      ],
    },
  })
}

/**
 * Initialize the DAE LSP client
 */
async function initLspClient(monacoInstance: Monaco): Promise<void> {
  if (lspInitialized) return
  if (lspInitialization) return lspInitialization

  const generation = lspGeneration
  lspInitialization = (async () => {
    // Create worker using Vite's ?worker import (returns a Worker constructor)
    const worker = new DaeLspWorker() as Worker

    // Create LSP client with the worker instance
    const client = new MonacoLspClient(worker)
    try {
      // Initialize the LSP connection
      await client.initialize()
      if (generation !== lspGeneration || lspOwners === 0) {
        client.dispose()
        return
      }
      lspClient = client

      // Register Monaco providers
      client.registerProviders(monacoInstance as unknown as typeof monacoEditor, 'routingA')

      // Apply any pending dynamic completion items that were set before LSP was initialized
      if (pendingDynamicCompletionItems.length > 0) {
        applyDynamicCompletionItems(pendingDynamicCompletionItems)
      }

      // Set up diagnostics handling
      client.onDiagnostics((uri, diagnostics) => {
        const model = monacoInstance.editor
          .getModels()
          .find((m: monacoEditor.editor.ITextModel) => m.uri.toString() === uri)
        if (model) {
          const markers = diagnostics.map((d) => ({
            severity:
              d.severity === DiagnosticSeverity.Error
                ? monacoInstance.MarkerSeverity.Error
                : d.severity === DiagnosticSeverity.Warning
                  ? monacoInstance.MarkerSeverity.Warning
                  : monacoInstance.MarkerSeverity.Info,
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            message: d.message,
            source: d.source || 'dae',
          }))
          monacoInstance.editor.setModelMarkers(model, 'dae', markers)
        }
      })

      lspInitialized = true
    } catch (error) {
      client.dispose()
      throw error
    }
  })()
  try {
    await lspInitialization
  } catch (error) {
    console.error('Failed to initialize DAE LSP client:', error)
    lspClient?.dispose()
    lspClient = null
  } finally {
    lspInitialization = null
  }
}

export interface LspOwner {
  dispose: () => void
}

export async function acquireLsp(monacoInstance: Monaco): Promise<LspOwner> {
  lspOwners += 1
  let released = false
  await initLspClient(monacoInstance)
  return {
    dispose() {
      if (released) return
      released = true
      lspOwners = Math.max(0, lspOwners - 1)
      if (lspOwners === 0) {
        disposeMonacoRuntime()
      }
    },
  }
}

export function disposeMonacoRuntime(): void {
  lspGeneration += 1
  lspClient?.dispose()
  lspClient = null
  lspInitialized = false
  lspInitialization = null
  lspOwners = 0
  for (const model of monaco.editor.getModels()) {
    if (!ownedModelUris.has(model.uri.toString())) continue
    monaco.editor.setModelMarkers(model, 'dae', [])
    model.dispose()
  }
  ownedModelUris.clear()
}

registerPageRetireHandler(disposeMonacoRuntime)

// Handler for beforeMount prop in Editor component
// Registers routingA language definition (LSP provides all providers)
export function handleEditorBeforeMount(monacoInstance: Monaco) {
  registerRoutingALanguage(monacoInstance)
  registerDnsALanguage(monacoInstance)
}

// Apply Shiki themes to Monaco (call after editor is mounted)
export async function applyShikiThemes(monacoInstance: Monaco) {
  await applyShikiThemesBase(monacoInstance)
}

/**
 * Initialize LSP for the editor (call after editor is mounted)
 */
/**
 * Get the LSP client instance
 */
export function getLspClient(): MonacoLspClient | null {
  return lspClient
}

/**
 * Sync a Monaco model with the LSP server
 * Call this when an editor opens a routingA document
 */
export function syncModelWithLsp(model: monacoEditor.editor.ITextModel): monacoEditor.IDisposable | null {
  if (!lspClient) return null

  const uri = model.uri.toString()
  const languageId = model.getLanguageId()

  // Only sync routingA documents
  if (languageId !== 'routingA') return null

  ownedModelUris.add(uri)
  // Open document
  lspClient.didOpen(uri, languageId, model.getVersionId(), model.getValue())

  // Listen for changes
  const changeDisposable = model.onDidChangeContent((event) => {
    if (!lspClient) return
    lspClient.didChange(
      uri,
      event.changes.map((change) => ({
        range: {
          start: {
            line: change.range.startLineNumber - 1,
            character: change.range.startColumn - 1,
          },
          end: {
            line: change.range.endLineNumber - 1,
            character: change.range.endColumn - 1,
          },
        },
        rangeLength: change.rangeLength,
        text: change.text,
      })),
      model.getVersionId(),
    )
  })

  // Return disposable to clean up
  return {
    dispose: () => {
      changeDisposable.dispose()
      if (lspClient) {
        lspClient.didClose(uri)
      }
      ownedModelUris.delete(uri)
    },
  }
}

/**
 * Set dynamic completion items for routingA language
 * Use this to add user-configured groups to autocomplete suggestions
 */
export function applyDynamicCompletionItems(items: RoutingCompletionItem[]): void {
  // Always cache the items for when LSP client is initialized later
  pendingDynamicCompletionItems = items

  setDynamicCompletionItemsBase(items as any)

  // Also set for LSP client if available
  if (lspClient) {
    lspClient.setDynamicCompletionItems(
      items.map((item) => ({
        label: item.label,
        kind: item.kind === 'variable' ? 6 : 14, // Variable or Keyword
        detail: item.detail,
        documentation: item.documentation,
        insertText: item.insertText,
      })),
    )
  }
}
