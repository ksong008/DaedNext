import type { CSSProperties } from 'react'
import type { ChartConfig } from '~/components/ui/chart'
import dayjs from 'dayjs'
import { Activity } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { useTrafficOverviewQuery } from '~/apis'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart'
import { cn } from '~/lib/utils'

type TimeRangeKey = '1m' | '10m' | '30m' | '1h'

interface TimeRangeOption {
  key: TimeRangeKey
  seconds: number
  maxPoints: number
  label: string
}

const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: '1m', seconds: 60, maxPoints: 120, label: '1m' },
  { key: '10m', seconds: 10 * 60, maxPoints: 240, label: '10m' },
  { key: '30m', seconds: 30 * 60, maxPoints: 360, label: '30m' },
  { key: '1h', seconds: 60 * 60, maxPoints: 480, label: '1h' },
]

const runtimeStatusStyle = {
  background: 'color-mix(in oklab, var(--card) 94%, var(--primary) 6%)',
  borderColor: 'color-mix(in oklab, var(--border) 78%, var(--primary) 22%)',
  boxShadow: '0 10px 24px color-mix(in oklab, var(--foreground) 7%, transparent)',
}

const runtimePanelStyle = {
  background: 'color-mix(in oklab, var(--accent) 42%, var(--card))',
  borderColor: 'color-mix(in oklab, var(--border) 82%, var(--primary) 18%)',
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

function createMetricTintStyle(highlight?: boolean): CSSProperties {
  return {
    backgroundColor: highlight
      ? 'color-mix(in oklab, var(--primary) 9%, var(--card))'
      : 'color-mix(in oklab, var(--accent) 54%, var(--card))',
    borderColor: highlight
      ? 'color-mix(in oklab, var(--primary) 24%, var(--border))'
      : 'color-mix(in oklab, var(--primary) 14%, var(--border))',
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

function formatClockTime(value: string | undefined) {
  return formatChartTime(value)
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
      className="min-h-[58px] rounded-xl border px-3 py-2 shadow-sm sm:min-h-[62px]"
      style={createMetricTintStyle(highlight)}
    >
      <p className="truncate text-[11px] font-semibold text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-base font-extrabold leading-none text-foreground sm:text-[1.05rem]">
          {amount}
        </span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  )
}

function toNumber(value: string | number | undefined | null) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function TrafficRangeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <Button
      variant="outline"
      size="xs"
      className={cn(
        'shrink-0 rounded-full border-border bg-accent/40 px-3 text-foreground shadow-none transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:border-border dark:bg-accent/40 dark:hover:bg-primary/10',
        active &&
          'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 dark:border-primary/40 dark:bg-primary/10 dark:hover:bg-primary/15',
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function TrafficOverview() {
  const { t } = useTranslation()
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('1m')

  const chartConfig = useMemo(
    () =>
      ({
        upload: { label: t('trafficOverview.uploadLegend'), color: 'var(--chart-1)' },
        download: { label: t('trafficOverview.downloadLegend'), color: 'var(--chart-2)' },
      }) satisfies ChartConfig,
    [t],
  )

  const selectedWindow = useMemo(
    () => TIME_RANGE_OPTIONS.find((option) => option.key === selectedRange) ?? TIME_RANGE_OPTIONS[1],
    [selectedRange],
  )

  const trafficOverviewQuery = useTrafficOverviewQuery(selectedWindow.seconds, selectedWindow.maxPoints)
  const runtimeOverview = trafficOverviewQuery.data
  const chartWindowEnd = useMemo(
    () => parseChartTimestampMs(runtimeOverview?.updatedAt) ?? Date.now(),
    [runtimeOverview?.updatedAt],
  )
  const chartWindowStart = useMemo(
    () => chartWindowEnd - selectedWindow.seconds * 1000,
    [chartWindowEnd, selectedWindow.seconds],
  )

  const latestSample = useMemo(
    () => ({
      uploadRate: runtimeOverview?.uploadRate ?? 0,
      downloadRate: runtimeOverview?.downloadRate ?? 0,
      uploadTotal: toNumber(runtimeOverview?.uploadTotal),
      downloadTotal: toNumber(runtimeOverview?.downloadTotal),
      activeConnections: runtimeOverview?.activeConnections ?? 0,
      udpSessions: runtimeOverview?.udpSessions ?? 0,
      rssBytes: toNumber(runtimeOverview?.rssBytes),
      heapAllocBytes: toNumber(runtimeOverview?.heapAllocBytes),
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
        ),
    [runtimeOverview?.samples],
  )
  const chartRateDomain = useMemo(() => computeDynamicRateDomain(combinedChartData), [combinedChartData])

  return (
    <Card withBorder shadow="sm" padding="none" className="overflow-hidden backdrop-blur-sm" style={runtimeStatusStyle}>
      <CardContent className="border-b border-border/70 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="rounded-full border border-primary/15 bg-primary/10 p-1.5 text-primary sm:p-2">
              <Activity className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <CardTitle className="truncate text-base text-foreground sm:text-lg">
              {t('trafficOverview.title')}
            </CardTitle>
            <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary sm:px-3 sm:py-1 sm:text-sm">
              {t('shell.live')}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {TIME_RANGE_OPTIONS.map((option) => (
              <TrafficRangeButton
                key={option.key}
                active={selectedRange === option.key}
                onClick={() => setSelectedRange(option.key)}
              >
                {t(`trafficOverview.ranges.${option.key}`)}
              </TrafficRangeButton>
            ))}
          </div>
        </div>
      </CardContent>

      <CardContent className="grid gap-3 px-3 py-3 sm:px-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div
          className="min-w-0 rounded-[16px] border p-2.5 shadow-sm sm:rounded-[18px] sm:p-3"
          style={runtimePanelStyle}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-muted-foreground sm:gap-4 sm:text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-1)]" />
              <span>{t('trafficOverview.uploadLegend')}</span>
              <strong className="font-semibold text-foreground">{formatRate(latestSample.uploadRate)}</strong>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-2)]" />
              <span>{t('trafficOverview.downloadLegend')}</span>
              <strong className="font-semibold text-foreground">{formatRate(latestSample.downloadRate)}</strong>
            </span>
          </div>

          <ChartContainer config={chartConfig} className="mt-2 h-[178px] w-full sm:h-[240px] xl:h-[260px]">
            <AreaChart data={combinedChartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="traffic-upload-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-upload)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-upload)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="traffic-download-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-download)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-download)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                scale="time"
                dataKey="timestamp"
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tickMargin={10}
                height={28}
                domain={[chartWindowStart, chartWindowEnd]}
                allowDataOverflow
                tickFormatter={(value) => formatChartTime(value)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={50}
                tickCount={4}
                tickFormatter={(value) => formatAxisRate(Number(value))}
                domain={chartRateDomain}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatChartTooltipTime(value)}
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
                strokeWidth={2.5}
                fill="url(#traffic-upload-fill)"
                isAnimationActive={false}
              />
              <Area
                dataKey="downloadRate"
                type="monotone"
                stroke="var(--color-download)"
                strokeWidth={2.5}
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
            amount={formatBytes(latestSample.heapAllocBytes).split(' ')[0]}
            unit={formatBytes(latestSample.heapAllocBytes).split(' ')[1] ?? ''}
          />
          <OverviewMetricCard title={t('trafficOverview.goroutines')} amount={latestSample.goroutines.toString()} />
          <OverviewMetricCard
            title={t('trafficOverview.lastUpdated')}
            amount={formatClockTime(runtimeOverview?.updatedAt)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
