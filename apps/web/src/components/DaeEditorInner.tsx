import type { Monaco } from '@monaco-editor/react'
import type * as monacoEditor from 'monaco-editor'
import type { DaeEditorProps } from './DaeEditor'
import { Editor } from '@monaco-editor/react'
import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EDITOR_OPTIONS, EDITOR_THEME_DARK, EDITOR_THEME_LIGHT } from '~/constants'
import { dynamicCompletionItemsAtom } from '~/editor_completions'
import {
  acquireLsp,
  applyDynamicCompletionItems,
  applyShikiThemes,
  getLspClient,
  handleEditorBeforeMount,
  isShikiReady,
  syncModelWithLsp,
} from '~/monaco'
import { colorSchemeAtom } from '~/store'

import '~/suppress-monaco-errors'

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
  const lspOwnerRef = useRef<{ dispose: () => void } | null>(null)
  const modelRef = useRef<monacoEditor.editor.ITextModel | null>(null)
  const retiredRef = useRef(false)

  useEffect(() => {
    return () => {
      retiredRef.current = true
      lspSyncRef.current?.dispose()
      lspSyncRef.current = null
      const model = modelRef.current
      modelRef.current = null
      if (model && !model.isDisposed()) {
        model.dispose()
      }
      lspOwnerRef.current?.dispose()
      lspOwnerRef.current = null
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

      const lspOwner = await acquireLsp(monacoInstance)
      if (retiredRef.current) {
        lspOwner.dispose()
        return
      }
      lspOwnerRef.current?.dispose()
      lspOwnerRef.current = lspOwner

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
