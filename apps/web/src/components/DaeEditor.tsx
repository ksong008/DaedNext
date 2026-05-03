import { lazy, Suspense } from 'react'

export type DaeConfigType = 'routing' | 'dns'

export interface DaeEditorProps {
  value: string
  onChange: (value: string) => void
  configType?: DaeConfigType
  height?: string | number
  disabled?: boolean
  active?: boolean
}

const LazyDaeEditorInner = lazy(async () => {
  const module = await import('./DaeEditorInner')
  return { default: module.DaeEditorInner }
})

function EditorFallback({ height = '100%' }: Pick<DaeEditorProps, 'height'>) {
  return (
    <div
      className="flex items-center justify-center rounded bg-muted/20 text-sm text-muted-foreground"
      style={{ height }}
    >
      Loading editor...
    </div>
  )
}

export function DaeEditor({ active = true, ...props }: DaeEditorProps) {
  if (!active) {
    return <EditorFallback height={props.height} />
  }

  return (
    <Suspense fallback={<EditorFallback height={props.height} />}>
      <LazyDaeEditorInner {...props} />
    </Suspense>
  )
}
