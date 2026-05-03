import { describe, expect, it } from 'vitest'

import type { TrafficOverviewQueryData } from './types'
import { mergeRuntimeOverviewDelta } from './runtime_overview'

describe('mergeRuntimeOverviewDelta', () => {
  it('appends new delta samples and updates scalar fields', () => {
    const previousData: TrafficOverviewQueryData = {
      updatedAt: '2026-05-03T13:00:00.000Z',
      uploadRate: 1,
      downloadRate: 2,
      uploadTotal: '10',
      downloadTotal: '20',
      activeConnections: 3,
      udpSessions: 4,
      rssBytes: '30',
      heapAllocBytes: '40',
      goroutines: 5,
      samples: [
        { timestamp: '2026-05-03T12:59:58.000Z', uploadRate: 10, downloadRate: 20 },
        { timestamp: '2026-05-03T12:59:59.000Z', uploadRate: 11, downloadRate: 21 },
      ],
    }

    const merged = mergeRuntimeOverviewDelta(
      previousData,
      {
        updatedAt: '2026-05-03T13:00:01.000Z',
        uploadRate: '6',
        downloadRate: '7',
        uploadTotal: '16',
        downloadTotal: '27',
        activeConnections: 8,
        udpSessions: 9,
        rssBytes: '31',
        heapAllocBytes: '41',
        goroutines: 10,
        samples: [{ timestamp: '2026-05-03T13:00:01.000Z', uploadRate: '12', downloadRate: '22' }],
      },
      60,
      120,
    )

    expect(merged.uploadRate).toBe(6)
    expect(merged.downloadRate).toBe(7)
    expect(merged.uploadTotal).toBe('16')
    expect(merged.downloadTotal).toBe('27')
    expect(merged.activeConnections).toBe(8)
    expect(merged.samples).toHaveLength(3)
    expect(merged.samples[2]).toEqual({
      timestamp: '2026-05-03T13:00:01.000Z',
      uploadRate: 12,
      downloadRate: 22,
    })
  })

  it('deduplicates samples by timestamp and respects window and maxPoints', () => {
    const previousData: TrafficOverviewQueryData = {
      updatedAt: '2026-05-03T13:00:03.000Z',
      uploadRate: 1,
      downloadRate: 2,
      uploadTotal: '10',
      downloadTotal: '20',
      activeConnections: 3,
      udpSessions: 4,
      rssBytes: '30',
      heapAllocBytes: '40',
      goroutines: 5,
      samples: [
        { timestamp: '2026-05-03T13:00:00.000Z', uploadRate: 1, downloadRate: 2 },
        { timestamp: '2026-05-03T13:00:01.000Z', uploadRate: 2, downloadRate: 3 },
        { timestamp: '2026-05-03T13:00:02.000Z', uploadRate: 3, downloadRate: 4 },
      ],
    }

    const merged = mergeRuntimeOverviewDelta(
      previousData,
      {
        updatedAt: '2026-05-03T13:00:04.000Z',
        uploadRate: '9',
        downloadRate: '10',
        uploadTotal: '19',
        downloadTotal: '30',
        activeConnections: 11,
        udpSessions: 12,
        rssBytes: '31',
        heapAllocBytes: '41',
        goroutines: 13,
        samples: [
          { timestamp: '2026-05-03T13:00:02.000Z', uploadRate: '30', downloadRate: '40' },
          { timestamp: '2026-05-03T13:00:04.000Z', uploadRate: '4', downloadRate: '5' },
        ],
      },
      2,
      2,
    )

    expect(merged.samples).toEqual([
      { timestamp: '2026-05-03T13:00:02.000Z', uploadRate: 30, downloadRate: 40 },
      { timestamp: '2026-05-03T13:00:04.000Z', uploadRate: 4, downloadRate: 5 },
    ])
  })
})
