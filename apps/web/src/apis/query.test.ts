import type { TrafficOverviewQueryData } from './types'

import { describe, expect, it } from 'vitest'
import { deriveTransport, resolveNodeTransport } from './node_transport'
import { mergeRuntimeOverviewDelta } from './runtime_overview'

async function loadBuildLogEventsURL() {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      hostname: '127.0.0.1',
      protocol: 'http:',
    },
  })

  return (await import('./query')).buildLogEventsURL
}

describe('deriveTransport', () => {
  it('marks SS2022 shadowsocks links as ss2022 transport', () => {
    expect(
      deriveTransport(
        'ss://2022-blake3-aes-128-gcm:MTIzNDU2Nzg5MDEyMzQ1Ng==@example.com:443#ss2022-node',
        'shadowsocks',
      ),
    ).toBe('ss2022')
  })

  it('uses VLESS flow instead of plain tcp for Vision links', () => {
    expect(
      deriveTransport(
        'vless://00000000-0000-0000-0000-000000000000@example.com:443?encryption=none&security=reality&sni=example.com&fp=chrome&pbk=abc&sid=123&type=tcp&flow=xtls-rprx-vision#vision',
        'vless',
      ),
    ).toBe('vision')
  })

  it('keeps the VLESS Vision udp443 flow suffix', () => {
    expect(
      deriveTransport(
        'vless://00000000-0000-0000-0000-000000000000@example.com:443?encryption=none&security=reality&sni=example.com&fp=chrome&pbk=abc&sid=123&type=tcp&flow=xtls-rprx-vision-udp443#vision-udp443',
        'vless',
      ),
    ).toBe('vision-udp443')
  })

  it('keeps VLESS non-Vision transport from net', () => {
    expect(
      deriveTransport(
        'vless://00000000-0000-0000-0000-000000000000@example.com:443?encryption=none&security=tls&type=ws&host=example.com&path=%2Fws#ws',
        'vless',
      ),
    ).toBe('ws')
  })

  it('prefers derived VLESS Vision flow over API tcp transport', () => {
    expect(
      resolveNodeTransport(
        'vless://00000000-0000-0000-0000-000000000000@example.com:443?encryption=none&security=reality&sni=example.com&fp=chrome&pbk=abc&sid=123&type=tcp&flow=xtls-rprx-vision#vision',
        'vless',
        'tcp',
      ),
    ).toBe('vision')
  })
})

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
      cpuUsagePercent: 1.5,
      rssBytes: '30',
      heapLiveBytes: '40',
      goroutines: 5,
      runtime: {
        running: true,
        state: 'running',
        attachBackend: 'tcx',
        netnsLinkMode: 'netkit',
        lastTransitionAt: '2026-05-03T12:00:00.000Z',
        reloadCount: 1,
      },
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
        cpuUsagePercent: 12.5,
        rssBytes: '31',
        heapLiveBytes: '41',
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
    expect(merged.cpuUsagePercent).toBe(12.5)
    expect(merged.runtime).toEqual(previousData.runtime)
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
      cpuUsagePercent: 1.5,
      rssBytes: '30',
      heapLiveBytes: '40',
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
        cpuUsagePercent: 2.5,
        rssBytes: '31',
        heapLiveBytes: '41',
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

describe('buildLogEventsURL', () => {
  it('uses stable API level values instead of localized display labels', async () => {
    const buildLogEventsURL = await loadBuildLogEventsURL()
    const url = buildLogEventsURL('http://127.0.0.1:2023', 'all', '')
    const parsed = new URL(url)

    expect(parsed.pathname).toBe('/api/events/logs')
    expect(parsed.searchParams.get('level')).toBe('all')
    expect(parsed.searchParams.has('access_token')).toBe(false)
    expect(parsed.toString()).not.toContain('%E5%85%A8%E9%83%A8')
  })

  it('keeps concrete runtime levels as API values', async () => {
    const buildLogEventsURL = await loadBuildLogEventsURL()
    const url = buildLogEventsURL('http://127.0.0.1:2023', 'debug', 'runtime')
    const parsed = new URL(url)

    expect(parsed.searchParams.get('level')).toBe('debug')
    expect(parsed.searchParams.get('q')).toBe('runtime')
    expect(parsed.searchParams.has('access_token')).toBe(false)
  })
})
