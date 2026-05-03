import type { DaeEditorProps } from './DaeEditor'
import type { Monaco } from '@monaco-editor/react'
import type * as monacoEditor from 'monaco-editor'
import { Editor } from '@monaco-editor/react'
import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EDITOR_OPTIONS, EDITOR_THEME_DARK, EDITOR_THEME_LIGHT } from '~/constants'
import { dynamicCompletionItemsAtom } from '~/editor_completions'
import {
  applyDynamicCompletionItems,
  applyShikiThemes,
  getLspClient,
  handleEditorBeforeMount,
  initLsp,
  isShikiReady,
  syncModelWithLsp,
} from '~/monaco'
import '~/suppress-monaco-errors'

import { colorSchemeAtom } from '~/store'

export function DaeEditorInner({
  value,
  onChange,
  configType = 'routing',
  height = '100%',
  disabled,
}: Omit<DaeEditorProps, 'active'>) {
  const colorScheme = useStore(colorSchemeAtom)
  const dynamicCompletionItems = useStore(dynamicCompletionItemsAtom)
  const [, forceUpdate] = useState({})
  const monacoRef = useRef<Monaco | null>(null)
  const lspSyncRef = useRef<{ dispose: () => void } | null>(null)
  const modelRef = useRef<monacoEditor.editor.ITextModel | null>(null)

  useEffect(() => {
    return () => {
      lspSyncRef.current?.dispose()
      lspSyncRef.current = null
    }
  }, [])

  useEffect(() => {
    const lspClient = getLspClient()
    if (lspClient) {
      lspClient.setConfigContext(configType)
    }
  }, [configType])

  useEffect(() => {
    applyDynamicCompletionItems(dynamicCompletionItems)
  }, [dynamicCompletionItems])

  const handleEditorDidMount = useCallback(
    async (
      editor: Parameters<typeof Editor>[0]['onMount'] extends ((e: infer E, ...args: unknown[]) => void) | undefined
        ? E
        : never,
      monacoInstance: Monaco,
    ) => {
      monacoRef.current = monacoInstance

      if (!isShikiReady()) {
        await applyShikiThemes(monacoInstance)
        forceUpdate({})
      }

      await initLsp(monacoInstance)

      const lspClient = getLspClient()
      if (lspClient) {
        lspClient.setConfigContext(configType)
      }
      applyDynamicCompletionItems(dynamicCompletionItems)

      const model = editor.getModel()
      if (model) {
        modelRef.current = model
        lspSyncRef.current?.dispose()
        lspSyncRef.current = syncModelWithLsp(model)
      }
    },
    [configType, dynamicCompletionItems],
  )

  const theme = isShikiReady()
    ? colorScheme === 'dark'
      ? EDITOR_THEME_DARK
      : EDITOR_THEME_LIGHT
    : colorScheme === 'dark'
      ? 'vs-dark'
      : 'vs'

  return (
    <Editor
      height={height}
      theme={theme}
      options={{
        ...EDITOR_OPTIONS,
        readOnly: disabled,
      }}
      language={configType === 'dns' ? 'dnsA' : 'routingA'}
      value={value}
      onChange={(nextValue) => onChange(nextValue || '')}
      beforeMount={handleEditorBeforeMount}
      onMount={handleEditorDidMount}
    />
  )
}
