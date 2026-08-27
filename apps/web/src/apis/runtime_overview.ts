import type { RuntimeOverviewRuntimeState, RuntimeRevisionReport, TrafficOverviewQueryData } from './types'

interface RuntimeOverviewAPI {
  updatedAt: string
  uploadRate: string
  downloadRate: string
  uploadTotal: string
  downloadTotal: string
  activeConnections: number
  udpSessions: number
  cpuUsagePercent?: number
  rssBytes?: string
  heapLiveBytes?: string | null
  goroutines?: number
  trafficAvailable?: boolean
  trafficSampleStatus?: string
  trafficScope?: string
  directIncluded?: boolean
  counterEpoch?: number
  trafficAgeMs?: number | null
  lastTrafficSampleAt?: string | null
  sequence?: number
  runtime?: RuntimeOverviewRuntimeState
  runtimeRevision?: RuntimeRevisionReport
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
  const finiteRate = (value: string | number | undefined) => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }
  const samples = (data.samples ?? [])
    .map((sample) => ({
      timestamp: sample.timestamp,
      uploadRate: finiteRate(sample.uploadRate),
      downloadRate: finiteRate(sample.downloadRate),
    }))
    .filter((sample) => Number.isFinite(Date.parse(sample.timestamp)))
  return {
    updatedAt: data.updatedAt,
    uploadRate: finiteRate(data.uploadRate),
    downloadRate: finiteRate(data.downloadRate),
    uploadTotal: data.uploadTotal,
    downloadTotal: data.downloadTotal,
    activeConnections: data.activeConnections,
    udpSessions: data.udpSessions,
    cpuUsagePercent: data.cpuUsagePercent ?? 0,
    rssBytes: data.rssBytes || '0',
    heapLiveBytes: data.heapLiveBytes || '0',
    goroutines: data.goroutines ?? 0,
    runtime: data.runtime,
    runtimeRevision: data.runtimeRevision,
    trafficAvailable: data.trafficAvailable ?? true,
    trafficSampleStatus: normalizeTrafficSampleStatus(data.trafficSampleStatus),
    trafficScope: data.trafficScope ?? 'resident-userspace-payload',
    directIncluded: data.directIncluded ?? false,
    counterEpoch: Number.isFinite(data.counterEpoch) ? Math.max(0, data.counterEpoch ?? 0) : 0,
    trafficAgeMs: finiteNullable(data.trafficAgeMs),
    lastTrafficSampleAt: data.lastTrafficSampleAt ?? null,
    sequence: Number.isFinite(data.sequence) ? data.sequence : undefined,
    samples,
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

  const deltaSamples = (delta.samples ?? [])
    .map((sample) => ({
      timestamp: sample.timestamp,
      uploadRate: finiteNonNegative(sample.uploadRate),
      downloadRate: finiteNonNegative(sample.downloadRate),
    }))
    .filter((sample) => Number.isFinite(Date.parse(sample.timestamp)))

  return {
    updatedAt: delta.updatedAt,
    uploadRate: finiteNonNegative(delta.uploadRate),
    downloadRate: finiteNonNegative(delta.downloadRate),
    uploadTotal: delta.uploadTotal ?? previousData.uploadTotal,
    downloadTotal: delta.downloadTotal ?? previousData.downloadTotal,
    activeConnections: delta.activeConnections ?? previousData.activeConnections,
    udpSessions: delta.udpSessions ?? previousData.udpSessions,
    cpuUsagePercent: delta.cpuUsagePercent ?? previousData.cpuUsagePercent ?? 0,
    rssBytes: delta.rssBytes || previousData.rssBytes || '0',
    heapLiveBytes: delta.heapLiveBytes || previousData.heapLiveBytes || '0',
    goroutines: delta.goroutines ?? previousData.goroutines ?? 0,
    runtime: delta.runtime ?? previousData.runtime,
    runtimeRevision: delta.runtimeRevision ?? previousData.runtimeRevision,
    trafficAvailable: delta.trafficAvailable ?? previousData.trafficAvailable,
    trafficSampleStatus: delta.trafficSampleStatus
      ? normalizeTrafficSampleStatus(delta.trafficSampleStatus)
      : previousData.trafficSampleStatus,
    trafficScope: delta.trafficScope ?? previousData.trafficScope,
    directIncluded: delta.directIncluded ?? previousData.directIncluded,
    counterEpoch: Number.isFinite(delta.counterEpoch)
      ? (delta.counterEpoch ?? previousData.counterEpoch)
      : previousData.counterEpoch,
    trafficAgeMs: delta.trafficAgeMs === undefined ? previousData.trafficAgeMs : finiteNullable(delta.trafficAgeMs),
    lastTrafficSampleAt:
      delta.lastTrafficSampleAt === undefined ? previousData.lastTrafficSampleAt : (delta.lastTrafficSampleAt ?? null),
    sequence: Number.isFinite(delta.sequence) ? delta.sequence : previousData.sequence,
    samples: trimRuntimeOverviewSamples(
      [...previousData.samples, ...deltaSamples],
      delta.updatedAt,
      windowSec,
      maxPoints,
    ),
  }
}

function finiteNonNegative(value: string | number | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function finiteNullable(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) || value < 0 ? null : value
}

function normalizeTrafficSampleStatus(value: string | undefined): TrafficOverviewQueryData['trafficSampleStatus'] {
  if (value === 'active' || value === 'temporarily-unavailable' || value === 'runtime-stopped') return value
  return 'unknown'
}
