import { describe, expect, it } from 'vitest'

import { deriveRuntimeStatus } from './runtime_status'

describe('deriveRuntimeStatus', () => {
  it('reports a running daemon without exposing generation details', () => {
    expect(
      deriveRuntimeStatus({
        running: true,
        state: 'running',
        activeGeneration: 'runtime-7',
        applyCoordinator: { state: 'idle' },
      }),
    ).toEqual({ status: 'running' })
  })

  it('keeps configuration outcomes out of the runtime status', () => {
    expect(deriveRuntimeStatus({ running: true, applyCoordinator: { state: 'preflight' } }).status).toBe('running')
    expect(
      deriveRuntimeStatus({ running: true, applyCoordinator: { state: 'idle', lastResult: 'coalesced' } }).status,
    ).toBe('running')
    expect(
      deriveRuntimeStatus({ running: true, applyCoordinator: { state: 'idle', lastResult: 'failed' } }).status,
    ).toBe('running')
  })

  it('reports lifecycle transitions in simple runtime terms', () => {
    expect(deriveRuntimeStatus({ running: false, applyCoordinator: { state: 'preflight' } }).status).toBe('starting')
    expect(deriveRuntimeStatus({ running: false, applyCoordinator: { state: 'revalidating-host' } }).status).toBe(
      'starting',
    )
    expect(deriveRuntimeStatus({ running: true, cleanup: { running: true } }).status).toBe('stopping')
  })

  it('reports a stopped runtime error as abnormal', () => {
    expect(deriveRuntimeStatus({ running: false, state: 'error', lastError: 'start failed' }).status).toBe('failed')
  })

  it('distinguishes stopped and unavailable runtime data', () => {
    expect(deriveRuntimeStatus({ running: false, state: 'stopped' }).status).toBe('stopped')
    expect(deriveRuntimeStatus().status).toBe('unknown')
  })
})
