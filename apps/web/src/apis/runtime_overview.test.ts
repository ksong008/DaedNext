import { describe, expect, it } from 'vitest'
import {
  acceptRuntimeOverview,
  adaptRuntimeOverview,
  createRuntimeOverviewCursor,
  runtimeOverviewHasDeltaBaseline,
} from './runtime_overview'

const now = Date.parse('2026-09-05T10:00:00Z')
const payload = (sequence: number, offset = 0, counterEpoch = 1) => ({
  sequence,
  updatedAt: new Date(now + offset).toISOString(),
  counterEpoch,
  uploadRate: '1',
  downloadRate: '2',
  uploadTotal: '3',
  downloadTotal: '4',
  activeConnections: 1,
  udpSessions: 1,
})

describe('runtime overview cursor', () => {
  it('keeps sampler and feed sequences separate and rejects duplicate or late data', () => {
    const cursor = createRuntimeOverviewCursor()
    expect(acceptRuntimeOverview(cursor, payload(1), 'delta', now)).toBe(false)
    expect(acceptRuntimeOverview(cursor, payload(100), 'snapshot', now)).toBe(true)
    expect(acceptRuntimeOverview(cursor, payload(2, 1000), 'delta', now + 1000)).toBe(true)
    expect(acceptRuntimeOverview(cursor, payload(2, 1000), 'delta', now + 1000)).toBe(false)
    expect(acceptRuntimeOverview(cursor, payload(101), 'rest', now + 1000)).toBe(false)
    expect(acceptRuntimeOverview(cursor, payload(102, 2000), 'rest', now + 2000)).toBe(true)
  })

  it('reestablishes a connection baseline only with a fresh full snapshot', () => {
    const cursor = createRuntimeOverviewCursor()
    acceptRuntimeOverview(cursor, payload(100), 'snapshot', now)
    acceptRuntimeOverview(cursor, payload(10, 1000), 'delta', now + 1000)
    cursor.needsStreamSnapshot = true
    expect(acceptRuntimeOverview(cursor, payload(1, -1000), 'snapshot', now + 1000)).toBe(false)
    expect(acceptRuntimeOverview(cursor, payload(11, 2000), 'delta', now + 2000)).toBe(false)
    expect(acceptRuntimeOverview(cursor, payload(1, 2000), 'snapshot', now + 2000)).toBe(true)
    expect(acceptRuntimeOverview(cursor, payload(1, 3000), 'delta', now + 3000)).toBe(true)
    expect(runtimeOverviewHasDeltaBaseline(undefined, payload(2))).toBe(false)
    expect(runtimeOverviewHasDeltaBaseline(adaptRuntimeOverview(payload(1)), payload(2, 0, 2))).toBe(false)
    expect(runtimeOverviewHasDeltaBaseline(adaptRuntimeOverview(payload(1)), payload(2))).toBe(true)
  })
})
