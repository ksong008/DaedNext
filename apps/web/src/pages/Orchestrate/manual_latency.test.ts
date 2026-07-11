import type { NodeLatencyJob } from '~/apis'

import { describe, expect, it } from 'vitest'

import { isLatencyJobActive, manualLatencyProgressFromJob } from './manual_latency'

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
    expect(isLatencyJobActive(job('cancelling'))).toBe(true)
    expect(manualLatencyProgressFromJob(job('cancelling'), 12)).toEqual({
      completed: 3,
      total: 10,
      jobId: '7',
    })
  })

  it('does not fabricate failed node results when no backend job can be recovered', () => {
    expect(manualLatencyProgressFromJob(null, 12)).toBeNull()
    expect(isLatencyJobActive(job('cancelled'))).toBe(false)
  })
})
