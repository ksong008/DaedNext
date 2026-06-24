import type { CSSProperties } from 'react'
import type { TrafficOverviewQueryData } from '~/apis/types'
import type { ChartConfig } from '~/components/ui/chart'
import dayjs from 'dayjs'
import { Activity } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart'
import { cn } from '~/lib/utils'
import { computeTrafficChartDomain, filterTrafficChartDataByDomain } from './traffic_chart'

export const REALTIME_TRAFFIC_WINDOW_SECONDS = 60
export const REALTIME_TRAFFIC_MAX_POINTS = 240

const runtimeStatusStyle = {
  background: 'color-mix(in oklab, var(--card) 97%, var(--primary) 3%)',
  borderColor: 'color-mix(in oklab, var(--border) 90%, var(--primary) 10%)',
  boxShadow: '0 7px 18px color-mix(in oklab, var(--foreground) 4%, transparent)',
}

const runtimePanelStyle = {
  background: 'color-mix(in oklab, var(--accent) 22%, var(--card))',
  borderColor: 'color-mix(in oklab, var(--border) 92%, var(--primary) 8%)',
}

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
  return timestampMs === null ? fallback : dayjs(timestampMs).format('HH:mm')
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

function createMetricTintStyle(highlight?: boolean): CSSProperties {
  return {
    backgroundColor: highlight
      ? 'color-mix(in oklab, var(--primary) 6%, var(--card))'
      : 'color-mix(in oklab, var(--accent) 30%, var(--card))',
    borderColor: highlight
      ? 'color-mix(in oklab, var(--primary) 14%, var(--border))'
      : 'color-mix(in oklab, var(--primary) 7%, var(--border))',
  }
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
    <div
      className="min-h-[56px] rounded-[14px] border px-3 py-2 shadow-none sm:min-h-[60px]"
      style={createMetricTintStyle(highlight)}
    >
      <p className="truncate text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-base font-bold leading-none text-foreground sm:text-[1.05rem]">{amount}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  )
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return now
}

function CurrentTimeText({ now, className }: { now: Date; className?: string }) {
  return (
    <time
      dateTime={now.toISOString()}
      className={cn('text-sm font-semibold leading-none text-foreground tabular-nums sm:text-base', className)}
    >
      {dayjs(now).format('HH:mm:ss')}
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
type RuntimeStatusTone = 'default' | 'pnameComm'

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

  if (source === 'current_comm' || semantics === 'non_core_task_comm' || cgroupPname?.nonCoreTaskCommEnabled) {
    return 'pnameComm'
  }

  return 'default'
}

function StatusBadge({
  running,
  label,
  tone = 'default',
}: {
  running?: boolean
  label: string
  tone?: RuntimeStatusTone
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold sm:px-3 sm:py-1 sm:text-sm',
        running &&
          tone === 'pnameComm' &&
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        running && tone === 'default' && 'border-primary/12 bg-primary/8 text-primary',
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
  const now = useCurrentTime()

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
    runtime?.running && runtimeStartMs !== null
      ? formatRuntimeDuration(now.getTime() - runtimeStartMs, runtimeDurationUnits)
      : '—'
  const runtimeStatusLabel =
    typeof runtime?.running === 'boolean' ? (runtime.running ? t('shell.running') : t('shell.stopped')) : '—'
  const runtimeStatusBadgeTone = runtimeStatusTone(runtime)
  const attachBackendLabel = formatRuntimeToken(runtime?.attachBackend)
  const linkModeLabel = formatRuntimeToken(runtime?.netnsLinkMode)
  const minLatencyLabel =
    typeof minLatencyMs === 'number' && Number.isFinite(minLatencyMs) ? `${minLatencyMs} ms` : t('latency.unavailable')

  return (
    <Card withBorder shadow="sm" padding="none" className="overflow-hidden backdrop-blur-sm" style={runtimeStatusStyle}>
      <CardContent className="border-b border-border/55 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="rounded-full border border-primary/12 bg-primary/7 p-1.5 text-primary sm:p-2">
              <Activity className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <CardTitle className="truncate text-base text-foreground sm:text-lg">
              {t('trafficOverview.title')}
            </CardTitle>
            <StatusBadge running={runtime?.running} label={runtimeStatusLabel} tone={runtimeStatusBadgeTone} />
          </div>
          <CurrentTimeText now={now} className="justify-self-end lg:col-start-3 lg:row-start-1" />
          <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex-nowrap lg:overflow-hidden">
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
          </div>
        </div>
      </CardContent>

      <CardContent className="grid gap-3 px-3 py-3 sm:px-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="min-w-0 rounded-[18px] border p-2.5 shadow-none sm:p-3" style={runtimePanelStyle}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground sm:gap-x-4 sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
              <span>{t('trafficOverview.uploadLegend')}</span>
              <strong className="font-semibold text-foreground">{formatRate(latestSample.uploadRate)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" />
              <span>{t('trafficOverview.downloadLegend')}</span>
              <strong className="font-semibold text-foreground">{formatRate(latestSample.downloadRate)}</strong>
            </span>
          </div>

          <ChartContainer config={chartConfig} className="mt-2 h-[166px] w-full sm:h-[230px] xl:h-[250px]">
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
                minTickGap={24}
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

        <div className="grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-2">
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
