import type { NodeLatencyJob } from '~/apis'

import { describe, expect, it } from 'vitest'

import { isNodeLatencyJobActive } from '~/apis/node_latency_job'
import { manualLatencyProgressFromJob, ManualLatencyTerminalTracker } from './manual_latency'

function job(status: string): NodeLatencyJob {
  return {
    id: '7',
    status,
    total: 10,
    completed: 3,
    succeeded: 2,
    failed: 1,
    queuedAt: '2026-07-11T00:00:00Z',
  }
}

describe('manual latency ownership', () => {
  it('keeps a cancelling backend job visible until it reaches a terminal state', () => {
    expect(isNodeLatencyJobActive(job('cancelling'))).toBe(true)
    expect(manualLatencyProgressFromJob(job('cancelling'), 12)).toEqual({
      state: 'cancelling',
      completed: 3,
      total: 10,
      jobId: '7',
    })
  })

  it('maps queued and running jobs to the explicit running state', () => {
    expect(manualLatencyProgressFromJob(job('queued'), 12)?.state).toBe('running')
    expect(manualLatencyProgressFromJob(job('running'), 12)?.state).toBe('running')
  })

  it('does not fabricate failed node results when no backend job can be recovered', () => {
    expect(manualLatencyProgressFromJob(null, 12)).toBeNull()
    expect(isNodeLatencyJobActive(job('cancelled'))).toBe(false)
  })

  it('refreshes dependent views once when an active job becomes terminal', () => {
    const tracker = new ManualLatencyTerminalTracker()

    expect(tracker.shouldRefresh(job('queued'))).toBe(false)
    expect(tracker.shouldRefresh(job('running'))).toBe(false)
    expect(tracker.shouldRefresh(job('finished'))).toBe(true)
    expect(tracker.shouldRefresh(job('finished'))).toBe(false)
    expect(tracker.shouldRefresh(null)).toBe(false)
  })

  it('treats a cleared active job and a replacement job as separate terminal transitions', () => {
    const tracker = new ManualLatencyTerminalTracker()
    const replacement = { ...job('running'), id: '8' }

    expect(tracker.shouldRefresh(job('running'))).toBe(false)
    expect(tracker.shouldRefresh(null)).toBe(true)
    expect(tracker.shouldRefresh(null)).toBe(false)
    expect(tracker.shouldRefresh(replacement)).toBe(false)
    expect(tracker.shouldRefresh({ ...replacement, status: 'failed' })).toBe(true)
  })

  it('refreshes a reused job id after a backend lifecycle replacement', () => {
    const tracker = new ManualLatencyTerminalTracker()

    expect(tracker.shouldRefresh(job('finished'))).toBe(true)
    expect(tracker.shouldRefresh(job('running'))).toBe(false)
    expect(tracker.shouldRefresh(job('finished'))).toBe(true)
  })
})
