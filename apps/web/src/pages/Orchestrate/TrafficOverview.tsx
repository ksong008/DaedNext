import type { CSSProperties } from 'react'
import type { TrafficOverviewQueryData } from '~/apis/types'
import type { ChartConfig } from '~/components/ui/chart'
import dayjs from 'dayjs'
import { Activity, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { deriveRuntimeStatus } from '~/apis/runtime_status'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart'
import { cn } from '~/lib/utils'
import { computeTrafficChartDomain, filterTrafficChartDataByDomain } from './traffic_chart'

export const REALTIME_TRAFFIC_WINDOW_SECONDS = 60
export const REALTIME_TRAFFIC_MAX_POINTS = 240

function formatBytes(value: number) {
  if (value < 1024) return `${value.toFixed(0)} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MB`
  return `${(value / 1024 ** 3).toFixed(1)} GB`
}

function formatRate(value: number) {
  return `${formatBytes(value)}/s`
}

function formatCPUUsage(value: number) {
  const normalized = Number.isFinite(value) && value > 0 ? value : 0
  if (normalized < 10) return normalized.toFixed(1)
  if (normalized < 100) return normalized.toFixed(0)
  return normalized.toFixed(0)
}

function formatAxisRate(value: number) {
  if (value < 1024) return `${value.toFixed(0)}B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)}K`
  return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)}M`
}

function normalizeEpochMs(value: number) {
  if (!Number.isFinite(value)) return null

  // Numeric timestamps from APIs are usually milliseconds, but handle seconds too.
  return Math.abs(value) > 0 && Math.abs(value) < 10_000_000_000 ? value * 1000 : value
}

function parseChartTimestampMs(value: unknown) {
  if (typeof value === 'number') {
    return normalizeEpochMs(value)
  }

  if (typeof value === 'string') {
    const numericValue = Number(value)
    if (value.trim() && Number.isFinite(numericValue)) {
      return normalizeEpochMs(numericValue)
    }

    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatChartTime(value: unknown, fallback = '--:--') {
  const timestampMs = parseChartTimestampMs(value)
  return timestampMs === null ? fallback : dayjs(timestampMs).format('HH:mm:ss')
}

function formatChartTooltipTime(value: unknown) {
  const timestampMs = parseChartTimestampMs(value)
  return timestampMs === null ? '--:--:--' : dayjs(timestampMs).format('HH:mm:ss')
}

function formatTrafficTooltipLabel(value: unknown, payload: unknown) {
  if (Array.isArray(payload)) {
    const timestamp = (payload[0] as { payload?: { timestamp?: unknown } } | undefined)?.payload?.timestamp
    if (timestamp !== undefined && timestamp !== null) {
      return formatChartTooltipTime(timestamp)
    }
  }

  return formatChartTooltipTime(value)
}

function computeDynamicRateDomain(
  data: Array<{
    uploadRate: number
    downloadRate: number
  }>,
): [number, number] {
  const values = data
    .flatMap((sample) => [sample.uploadRate, sample.downloadRate])
    .filter((value) => Number.isFinite(value))

  if (values.length === 0) {
    return [0, 1]
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  if (minValue === maxValue) {
    const padding = Math.max(minValue * 0.18, 1)
    return [Math.max(0, minValue - padding), maxValue + padding]
  }

  const padding = (maxValue - minValue) * 0.18
  return [Math.max(0, minValue - padding), maxValue + padding]
}

function OverviewMetricCard({
  title,
  amount,
  unit,
  highlight,
}: {
  title: string
  amount: string
  unit?: string
  highlight?: boolean
}) {
  return (
    <div className={cn('overview-metric min-w-0 border-b border-border px-2.5 py-2', highlight && 'bg-primary/5')}>
      <p className="truncate text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span className="truncate font-mono text-base font-medium leading-none tracking-tight text-foreground">
          {amount}
        </span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  )
}

function CurrentTimeText({ now, className }: { now: Date | null; className?: string }) {
  return (
    <time
      dateTime={now?.toISOString()}
      className={cn('text-xs font-semibold leading-none text-foreground tabular-nums', className)}
    >
      {now ? dayjs(now).format('HH:mm:ss') : '—'}
    </time>
  )
}

function toNumber(value: string | number | undefined | null) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatRuntimeToken(value: string | null | undefined) {
  const token = value?.trim()
  if (!token) return '—'

  switch (token.toLowerCase()) {
    case 'tcx':
      return 'Tcx'
    case 'tc':
    case 'tc-netlink':
    case 'tc_netlink':
    case 'tc-command-fallback':
    case 'tc_command_fallback':
      return 'Tc'
    case 'tcx+tc':
    case 'tcx-tc':
    case 'mixed':
      return 'Tcx+Tc'
    case 'netkit':
      return 'Netkit'
    case 'veth':
      return 'Veth'
    default:
      return token
  }
}

type HeaderChipTone = 'neutral' | 'tcx' | 'tc' | 'netkit' | 'veth' | 'latency' | 'resource'
type RuntimeStatusTone = 'enhanced' | 'comm'

function runtimeTokenTone(value: string) {
  switch (value) {
    case 'Tcx':
      return 'tcx'
    case 'Tc':
      return 'tc'
    case 'Tcx+Tc':
      return 'tcx'
    case 'Netkit':
      return 'netkit'
    case 'Veth':
      return 'veth'
    default:
      return 'neutral'
  }
}

function createHeaderChipStyle(): CSSProperties {
  return {
    backgroundColor: 'var(--shell-control)',
    borderColor: 'var(--shell-line)',
    color: 'var(--muted-foreground)',
  }
}

function createHeaderChipValueStyle(tone: HeaderChipTone): CSSProperties {
  const accentByTone: Record<HeaderChipTone, string> = {
    neutral: 'var(--foreground)',
    tcx: 'var(--chart-1)',
    tc: 'var(--chart-5)',
    netkit: 'var(--chart-2)',
    veth: 'var(--chart-4)',
    latency: 'var(--chart-3)',
    resource: 'var(--foreground)',
  }
  const accent = accentByTone[tone]

  return {
    color: `color-mix(in oklab, ${accent} 84%, var(--foreground))`,
  }
}

function formatRuntimeDuration(
  ms: number,
  units: {
    days: string
    hours: string
    minutes: string
    seconds: string
  },
) {
  if (!Number.isFinite(ms) || ms < 0) return '—'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}${units.days} ${hours}${units.hours}`
  if (hours > 0) return `${hours}${units.hours} ${minutes}${units.minutes}`
  if (minutes > 0) return `${minutes}${units.minutes}`
  return `${seconds}${units.seconds}`
}

function parseRuntimeStartMs(startedAt?: string | null, lastTransitionAt?: string | null) {
  const timestamp = startedAt || lastTransitionAt
  if (!timestamp) return null

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : null
}

function runtimeStatusTone(runtime?: TrafficOverviewQueryData['runtime']): RuntimeStatusTone {
  const cgroupPname = runtime?.startupEvidence?.cgroupPname
  const source = cgroupPname?.source?.trim().toLowerCase()
  const semantics = cgroupPname?.semantics?.trim().toLowerCase()

  if (source === 'current_comm' || semantics === 'non_core_task_comm') {
    return 'comm'
  }

  return 'enhanced'
}

function StatusBadge({
  running,
  label,
  tone = 'enhanced',
  title,
}: {
  running?: boolean
  label: string
  tone?: RuntimeStatusTone
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        running && tone === 'comm' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        running && tone === 'enhanced' && 'border-primary/12 bg-primary/8 text-primary',
        !running && 'border-muted-foreground/16 bg-muted/50 text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

function HeaderChip({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label?: string
  value: string
  tone?: HeaderChipTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-none transition-colors sm:text-xs',
        className,
      )}
      style={createHeaderChipStyle()}
    >
      {label ? <span className="shrink-0 text-muted-foreground">{label}</span> : null}
      <strong
        className={cn('min-w-0 truncate font-semibold', !label && 'tracking-normal')}
        style={createHeaderChipValueStyle(tone)}
      >
        {value}
      </strong>
    </span>
  )
}

interface TrafficOverviewProps {
  nodeCount?: number
  subscriptionCount?: number
  minLatencyMs?: number
  runtimeOverview?: TrafficOverviewQueryData
}

export function TrafficOverview({ nodeCount, subscriptionCount, minLatencyMs, runtimeOverview }: TrafficOverviewProps) {
  const { t } = useTranslation()
  // Derive time from telemetry; a second timer would rerender the whole chart.
  const sampleTime = parseChartTimestampMs(runtimeOverview?.updatedAt)
  const now = sampleTime === null ? null : new Date(sampleTime)

  const chartConfig = useMemo(
    () =>
      ({
        upload: { label: t('trafficOverview.uploadLegend'), color: 'var(--chart-1)' },
        download: { label: t('trafficOverview.downloadLegend'), color: 'var(--chart-2)' },
      }) satisfies ChartConfig,
    [t],
  )

  const chartWindowEnd = useMemo(
    () => parseChartTimestampMs(runtimeOverview?.updatedAt) ?? Date.now(),
    [runtimeOverview?.updatedAt],
  )
  const latestSample = useMemo(
    () => ({
      uploadRate: runtimeOverview?.uploadRate ?? 0,
      downloadRate: runtimeOverview?.downloadRate ?? 0,
      uploadTotal: toNumber(runtimeOverview?.uploadTotal),
      downloadTotal: toNumber(runtimeOverview?.downloadTotal),
      activeConnections: runtimeOverview?.activeConnections ?? 0,
      udpSessions: runtimeOverview?.udpSessions ?? 0,
      cpuUsagePercent: runtimeOverview?.cpuUsagePercent ?? 0,
      rssBytes: toNumber(runtimeOverview?.rssBytes),
      heapLiveBytes: toNumber(runtimeOverview?.heapLiveBytes),
      goroutines: runtimeOverview?.goroutines ?? 0,
    }),
    [runtimeOverview],
  )

  const combinedChartData = useMemo(
    () =>
      (runtimeOverview?.samples ?? [])
        .map((sample) => ({
          timestamp: parseChartTimestampMs(sample.timestamp),
          uploadRate: sample.uploadRate,
          downloadRate: sample.downloadRate,
        }))
        .filter((sample): sample is { timestamp: number; uploadRate: number; downloadRate: number } =>
          Number.isFinite(sample.timestamp),
        )
        .sort((left, right) => left.timestamp - right.timestamp),
    [runtimeOverview?.samples],
  )
  const chartWindowDomain = useMemo(
    () => computeTrafficChartDomain(combinedChartData, chartWindowEnd, REALTIME_TRAFFIC_WINDOW_SECONDS),
    [chartWindowEnd, combinedChartData],
  )
  const visibleChartData = useMemo(
    () => filterTrafficChartDataByDomain(combinedChartData, chartWindowDomain),
    [chartWindowDomain, combinedChartData],
  )
  const chartRateDomain = useMemo(() => computeDynamicRateDomain(visibleChartData), [visibleChartData])
  const runtime = runtimeOverview?.runtime
  const runtimeStatus = deriveRuntimeStatus(runtime)
  const runtimeDurationUnits = useMemo(
    () => ({
      days: t('trafficOverview.durationDays'),
      hours: t('trafficOverview.durationHours'),
      minutes: t('trafficOverview.durationMinutes'),
      seconds: t('trafficOverview.durationSeconds'),
    }),
    [t],
  )
  const runtimeStartMs = parseRuntimeStartMs(runtime?.startedAt, runtime?.lastTransitionAt)
  const runtimeDurationLabel =
    runtime?.running && runtimeStartMs !== null && now !== null
      ? formatRuntimeDuration(now.getTime() - runtimeStartMs, runtimeDurationUnits)
      : '—'
  const runtimeStatusLabel = t(`trafficOverview.runtimeStates.${runtimeStatus.status}` as never) as string
  const runtimeStatusBadgeTone = runtimeStatusTone(runtime)
  const attachBackendLabel = formatRuntimeToken(runtime?.attachBackend)
  const linkModeLabel = formatRuntimeToken(runtime?.netnsLinkMode)
  const minLatencyLabel =
    typeof minLatencyMs === 'number' && Number.isFinite(minLatencyMs) ? `${minLatencyMs} ms` : t('latency.unavailable')
  const trafficStatusLabel =
    runtimeOverview?.trafficAvailable === false
      ? t('trafficOverview.trafficUnavailable')
      : (runtimeOverview?.trafficAgeMs ?? 0) > 3_000
        ? t('trafficOverview.trafficStale')
        : t('trafficOverview.trafficActive')

  return (
    <Card withBorder padding="none" className="traffic-panel gap-0 overflow-hidden rounded-xl bg-card shadow-none">
      <CardContent className="border-b border-border px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="rounded-full border border-primary/12 bg-primary/7 p-1.5 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <CardTitle className="truncate text-base text-foreground">{t('trafficOverview.title')}</CardTitle>
            <StatusBadge
              running={runtimeStatus.status === 'running'}
              label={runtimeStatusLabel}
              tone={runtimeStatusBadgeTone}
              title={runtimeStatusLabel}
            />
          </div>
          <div className="text-right">
            <p className="mb-1 text-[10px] text-muted-foreground">{t('design.lastSample')}</p>
            <CurrentTimeText now={now} className="font-mono text-xs" />
          </div>
          <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5">
            <HeaderChip label={t('trafficOverview.runtimeDuration')} value={runtimeDurationLabel} />
            <HeaderChip
              label={t('trafficOverview.attachBackend')}
              value={attachBackendLabel}
              tone={runtimeTokenTone(attachBackendLabel)}
            />
            <HeaderChip
              label={t('trafficOverview.linkMode')}
              value={linkModeLabel}
              tone={runtimeTokenTone(linkModeLabel)}
            />
            <HeaderChip
              label={t('trafficOverview.minLatency')}
              value={minLatencyLabel}
              tone={typeof minLatencyMs === 'number' && Number.isFinite(minLatencyMs) ? 'latency' : 'neutral'}
            />
            <HeaderChip
              value={`${t('trafficOverview.subscriptions')} ${subscriptionCount ?? '—'} · ${t('trafficOverview.nodes')} ${nodeCount ?? '—'}`}
              tone="resource"
            />
            <HeaderChip
              label={t('trafficOverview.trafficStatus')}
              value={trafficStatusLabel}
              tone={trafficStatusLabel === t('trafficOverview.trafficActive') ? 'resource' : 'neutral'}
            />
          </div>
        </div>
      </CardContent>

      <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,1fr)_256px]">
        <div className="min-w-0 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowDownLeft className="h-3.5 w-3.5 text-[var(--chart-2)]" />
                  {t('trafficOverview.downloadLegend')}
                </p>
                <p className="whitespace-nowrap font-mono text-base font-medium tracking-tight sm:text-lg">
                  {formatRate(latestSample.downloadRate)}
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-[var(--chart-1)]" />
                  {t('trafficOverview.uploadLegend')}
                </p>
                <p className="whitespace-nowrap font-mono text-base font-medium tracking-tight sm:text-lg">
                  {formatRate(latestSample.uploadRate)}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              60 s
            </span>
          </div>

          <ChartContainer config={chartConfig} className="mt-2 h-[128px] w-full aspect-auto sm:h-[160px]">
            <AreaChart data={visibleChartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="traffic-upload-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-upload)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-upload)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="traffic-download-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-download)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="var(--color-download)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="color-mix(in oklab, var(--border) 42%, transparent)"
                strokeDasharray="3 3"
              />
              <XAxis
                type="number"
                scale="time"
                dataKey="timestamp"
                axisLine={false}
                tickLine={false}
                minTickGap={48}
                tickCount={5}
                tickMargin={10}
                height={28}
                tick={{ fontSize: 11, fill: 'color-mix(in oklab, var(--muted-foreground) 76%, transparent)' }}
                domain={chartWindowDomain}
                allowDataOverflow
                tickFormatter={(value) => formatChartTime(value)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={44}
                tickCount={4}
                tick={{ fontSize: 11, fill: 'color-mix(in oklab, var(--muted-foreground) 72%, transparent)' }}
                tickFormatter={(value) => formatAxisRate(Number(value))}
                domain={chartRateDomain}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value, payload) => formatTrafficTooltipLabel(value, payload)}
                    formatter={(value, name) =>
                      `${name === 'uploadRate' ? t('trafficOverview.uploadLegend') : t('trafficOverview.downloadLegend')}: ${formatRate(Number(value))}`
                    }
                    indicator="line"
                  />
                }
              />
              <Area
                dataKey="uploadRate"
                type="monotone"
                stroke="var(--color-upload)"
                strokeWidth={2.1}
                fill="url(#traffic-upload-fill)"
                isAnimationActive={false}
              />
              <Area
                dataKey="downloadRate"
                type="monotone"
                stroke="var(--color-download)"
                strokeWidth={2.1}
                fill="url(#traffic-download-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-x-2 border-t border-border px-2 py-2 sm:grid-cols-4 lg:grid-cols-2 lg:border-l lg:border-t-0">
          <OverviewMetricCard
            title={t('trafficOverview.totalUpload')}
            amount={formatBytes(latestSample.uploadTotal).split(' ')[0]}
            unit={formatBytes(latestSample.uploadTotal).split(' ')[1] ?? ''}
            highlight
          />
          <OverviewMetricCard
            title={t('trafficOverview.totalDownload')}
            amount={formatBytes(latestSample.downloadTotal).split(' ')[0]}
            unit={formatBytes(latestSample.downloadTotal).split(' ')[1] ?? ''}
            highlight
          />
          <OverviewMetricCard
            title={t('trafficOverview.activeConnections')}
            amount={latestSample.activeConnections.toString()}
            unit={t('trafficOverview.connectionsUnit')}
          />
          <OverviewMetricCard
            title={t('trafficOverview.udpSessions')}
            amount={latestSample.udpSessions.toString()}
            unit={t('trafficOverview.sessionsUnit')}
          />
          <OverviewMetricCard
            title={t('trafficOverview.rss')}
            amount={formatBytes(latestSample.rssBytes).split(' ')[0]}
            unit={formatBytes(latestSample.rssBytes).split(' ')[1] ?? ''}
          />
          <OverviewMetricCard
            title={t('trafficOverview.heapAlloc')}
            amount={formatBytes(latestSample.heapLiveBytes).split(' ')[0]}
            unit={formatBytes(latestSample.heapLiveBytes).split(' ')[1] ?? ''}
          />
          <OverviewMetricCard title={t('trafficOverview.goroutines')} amount={latestSample.goroutines.toString()} />
          <OverviewMetricCard
            title={t('trafficOverview.cpuUsage')}
            amount={formatCPUUsage(latestSample.cpuUsagePercent)}
            unit="%"
          />
        </div>
      </CardContent>
    </Card>
  )
}
