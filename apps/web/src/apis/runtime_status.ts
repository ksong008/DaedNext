import type { RuntimeOverviewRuntimeState } from './types'

export type RuntimeStatusKey = 'running' | 'starting' | 'stopping' | 'stopped' | 'failed' | 'unknown'

export interface RuntimeStatusPresentation {
  status: RuntimeStatusKey
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function deriveRuntimeStatus(runtime?: RuntimeOverviewRuntimeState): RuntimeStatusPresentation {
  const coordinatorState = normalized(runtime?.applyCoordinator?.state)
  const runtimeState = normalized(runtime?.state)

  if (!runtime) return { status: 'unknown' }
  if (coordinatorState === 'stopping' || runtimeState === 'stopping' || runtime.cleanup?.running) {
    return { status: 'stopping' }
  }
  if (runtime.running) {
    return { status: 'running' }
  }
  if (
    (coordinatorState && coordinatorState !== 'idle') ||
    runtimeState === 'starting' ||
    runtimeState === 'initializing' ||
    runtimeState.includes('waiting-for-host')
  ) {
    return { status: 'starting' }
  }
  if (runtimeState === 'error' || runtime.lastError) {
    return { status: 'failed' }
  }
  return { status: 'stopped' }
}
