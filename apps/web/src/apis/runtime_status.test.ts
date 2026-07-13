import { describe, expect, it } from 'vitest'

import { deriveRuntimeStatus } from './runtime_status'

describe('deriveRuntimeStatus', () => {
  it('reports active only for a generation-consistent running runtime', () => {
    expect(
      deriveRuntimeStatus(
        { running: true, state: 'running', activeGeneration: 'runtime-7', applyCoordinator: { state: 'idle' } },
        {
          desiredMatchesActive: true,
          activationIdentityConsistent: true,
          activeProductGeneration: 'runtime-7',
        },
      ),
    ).toMatchObject({
      status: 'active',
      activeGeneration: 'runtime-7',
      desiredMatchesActive: true,
      activationIdentityConsistent: true,
    })
  })

  it('keeps applying, waiting, and pending process transitions distinct', () => {
    expect(deriveRuntimeStatus({ running: true, applyCoordinator: { state: 'preflight' } }).status).toBe('applying')
    expect(deriveRuntimeStatus({ running: true, applyCoordinator: { state: 'revalidating-host' } }).status).toBe(
      'waitingForHost',
    )
    expect(
      deriveRuntimeStatus({
        running: true,
        applyCoordinator: { state: 'idle' },
        pendingProcessTransition: { state: 'pending-process-transition' },
      }).status,
    ).toBe('pendingProcessTransition')
  })

  it('does not let failed or stale generations repaint the current state as active', () => {
    expect(
      deriveRuntimeStatus(
        { running: true, applyCoordinator: { state: 'idle', lastResult: 'failed' } },
        { desiredMatchesActive: false, activationIdentityConsistent: true },
      ).status,
    ).toBe('failed')
    expect(
      deriveRuntimeStatus(
        { running: true, applyCoordinator: { state: 'idle' } },
        { desiredMatchesActive: true, activationIdentityConsistent: false },
      ).status,
    ).toBe('inconsistent')
  })

  it('keeps rollback, coalesced, and desired-pending outcomes visible', () => {
    expect(
      deriveRuntimeStatus({
        running: true,
        apply: { phase: 'rolled-back', rollbackResult: 'restored' },
        applyCoordinator: { state: 'idle', lastResult: 'failed' },
      }).status,
    ).toBe('rolledBack')
    expect(
      deriveRuntimeStatus(
        { running: true, applyCoordinator: { state: 'idle', lastResult: 'coalesced' } },
        { desiredMatchesActive: true, activationIdentityConsistent: true },
      ).status,
    ).toBe('coalesced')
    expect(
      deriveRuntimeStatus(
        { running: true, applyCoordinator: { state: 'idle' } },
        { pending: true, desiredMatchesActive: false, activationIdentityConsistent: true },
      ).status,
    ).toBe('pending')
  })
})
