import type { RuntimeOverviewRuntimeState, RuntimeRevisionReport } from './types'

export type RuntimeStatusKey =
  | 'active'
  | 'applying'
  | 'coalesced'
  | 'failed'
  | 'inconsistent'
  | 'pending'
  | 'pendingProcessTransition'
  | 'rolledBack'
  | 'stopped'
  | 'stopping'
  | 'unknown'
  | 'waitingForHost'

export interface RuntimeStatusPresentation {
  status: RuntimeStatusKey
  activeGeneration: string | null
  desiredMatchesActive: boolean | null
  activationIdentityConsistent: boolean | null
  lastApplyResult: string | null
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function isFailedResult(value: string): boolean {
  return value === 'failed' || value === 'abandoned' || value.endsWith('-failed')
}

export function deriveRuntimeStatus(
  runtime?: RuntimeOverviewRuntimeState,
  revision?: RuntimeRevisionReport,
): RuntimeStatusPresentation {
  const coordinatorState = normalized(runtime?.applyCoordinator?.state)
  const lastApplyResult = normalized(runtime?.applyCoordinator?.lastResult) || null
  const applyPhase = normalized(runtime?.apply?.phase)
  const runtimeState = normalized(runtime?.state)
  const activeGeneration = revision?.activeProductGeneration ?? runtime?.activeGeneration ?? null
  const desiredMatchesActive = revision?.desiredMatchesActive ?? null
  const activationIdentityConsistent = revision?.activationIdentityConsistent ?? null

  const base = {
    activeGeneration,
    desiredMatchesActive,
    activationIdentityConsistent,
    lastApplyResult,
  }

  if (!runtime) return { status: 'unknown', ...base }
  if (coordinatorState === 'stopping' || runtimeState === 'stopping' || runtime.cleanup?.running) {
    return { status: 'stopping', ...base }
  }
  if (coordinatorState === 'revalidating-host' || runtimeState.includes('waiting-for-host')) {
    return { status: 'waitingForHost', ...base }
  }
  if (coordinatorState && coordinatorState !== 'idle') {
    return { status: 'applying', ...base }
  }
  if (runtime.apply?.reconciliationRequired || activationIdentityConsistent === false) {
    return { status: 'inconsistent', ...base }
  }
  if (applyPhase === 'rolled-back' || runtime.apply?.rollbackResult === 'restored') {
    return { status: 'rolledBack', ...base }
  }
  if (runtime.pendingProcessTransition) {
    return { status: 'pendingProcessTransition', ...base }
  }
  if (
    runtimeState === 'error' ||
    isFailedResult(lastApplyResult ?? '') ||
    (runtime.lastError && applyPhase !== 'committed')
  ) {
    return { status: 'failed', ...base }
  }
  if (revision?.pending || desiredMatchesActive === false) {
    return { status: 'pending', ...base }
  }
  if (lastApplyResult === 'coalesced') {
    return { status: 'coalesced', ...base }
  }
  if (runtime.running) {
    return { status: 'active', ...base }
  }
  return { status: 'stopped', ...base }
}
