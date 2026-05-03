import type { TrafficOverviewQueryData } from './types'

type RuntimeOverviewAPI = {
  updatedAt: string
  uploadRate: string
  downloadRate: string
  uploadTotal: string
  downloadTotal: string
  activeConnections: number
  udpSessions: number
  rssBytes?: string
  heapAllocBytes?: string
  goroutines?: number
  samples?: Array<{
    timestamp: string
    uploadRate: string
    downloadRate: string
  }>
}

function runtimeSampleTimestampMs(sample: { timestamp: string }) {
  const parsed = Date.parse(sample.timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

function trimRuntimeOverviewSamples(
  samples: TrafficOverviewQueryData['samples'],
  updatedAt: string,
  windowSec: number,
  maxPoints: number,
) {
  const windowEnd = Date.parse(updatedAt)
  const windowStart = Number.isFinite(windowEnd) ? windowEnd - windowSec * 1000 : Number.NEGATIVE_INFINITY
  const dedupedByTimestamp = new Map<string, TrafficOverviewQueryData['samples'][number]>()

  for (const sample of samples) {
    const timestampMs = runtimeSampleTimestampMs(sample)
    if (timestampMs < windowStart) continue
    dedupedByTimestamp.set(sample.timestamp, sample)
  }

  const normalized = Array.from(dedupedByTimestamp.values()).sort(
    (left, right) => runtimeSampleTimestampMs(left) - runtimeSampleTimestampMs(right),
  )

  if (maxPoints > 0 && normalized.length > maxPoints) {
    return normalized.slice(normalized.length - maxPoints)
  }

  return normalized
}

export function adaptRuntimeOverview(data: RuntimeOverviewAPI): TrafficOverviewQueryData {
  return {
    updatedAt: data.updatedAt,
    uploadRate: Number(data.uploadRate),
    downloadRate: Number(data.downloadRate),
    uploadTotal: data.uploadTotal,
    downloadTotal: data.downloadTotal,
    activeConnections: data.activeConnections,
    udpSessions: data.udpSessions,
    rssBytes: data.rssBytes || '0',
    heapAllocBytes: data.heapAllocBytes || '0',
    goroutines: data.goroutines ?? 0,
    samples: (data.samples ?? []).map((sample) => ({
      timestamp: sample.timestamp,
      uploadRate: Number(sample.uploadRate),
      downloadRate: Number(sample.downloadRate),
    })),
  }
}

export function mergeRuntimeOverviewDelta(
  previousData: TrafficOverviewQueryData | undefined,
  delta: RuntimeOverviewAPI,
  windowSec: number,
  maxPoints: number,
): TrafficOverviewQueryData {
  if (!previousData) {
    return adaptRuntimeOverview(delta)
  }

  const deltaSamples = (delta.samples ?? []).map((sample) => ({
    timestamp: sample.timestamp,
    uploadRate: Number(sample.uploadRate),
    downloadRate: Number(sample.downloadRate),
  }))

  return {
    updatedAt: delta.updatedAt,
    uploadRate: Number(delta.uploadRate),
    downloadRate: Number(delta.downloadRate),
    uploadTotal: delta.uploadTotal,
    downloadTotal: delta.downloadTotal,
    activeConnections: delta.activeConnections,
    udpSessions: delta.udpSessions,
    rssBytes: delta.rssBytes || previousData.rssBytes || '0',
    heapAllocBytes: delta.heapAllocBytes || previousData.heapAllocBytes || '0',
    goroutines: delta.goroutines ?? previousData.goroutines ?? 0,
    samples: trimRuntimeOverviewSamples(
      [...previousData.samples, ...deltaSamples],
      delta.updatedAt,
      windowSec,
      maxPoints,
    ),
  }
}
