import type { ChartConfig } from '~/components/ui/chart'
import type { CSSProperties } from 'react'
import dayjs from 'dayjs'
import { Activity, Radio } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { useTrafficOverviewQuery } from '~/apis'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
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

function createTintStyle(colorVar: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklab, ${colorVar} 8%, var(--card))`,
    borderColor: `color-mix(in oklab, ${colorVar} 16%, var(--border))`,
  }
}

function computeDynamicRateDomain(
  data: Array<{
    uploadRate: number
    downloadRate: number
  }>,
): [number, number] {
  const values = data.flatMap((sample) => [sample.uploadRate, sample.downloadRate]).filter((value) => Number.isFinite(value))

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
  if (!value) return '--:--'
  return dayjs(value).format('HH:mm')
}

function MemoryMetricCard({
  title,
  amount,
  unit,
  colorVar,
}: {
  title: string
  amount: string
  unit?: string
  colorVar: string
}) {
  return (
    <div className="rounded-2xl border px-3.5 py-2.5 shadow-sm" style={createTintStyle(colorVar)}>
      <p className="truncate text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[1.15rem] font-extrabold leading-none tracking-tight text-foreground">{amount}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  )
}

function BannerMetricCard({
  title,
  amount,
  unit,
  colorVar,
}: {
  title: string
  amount: string
  unit?: string
  colorVar: string
}) {
  return (
    <div
      className="rounded-2xl border px-3.5 py-2.5 shadow-sm"
      style={createTintStyle(colorVar)}
    >
      <p className="truncate text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[1.15rem] font-extrabold leading-none tracking-tight text-foreground">{amount}</span>
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
        'shrink-0 rounded-full px-3 transition-colors',
        active && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
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
    () => (runtimeOverview?.updatedAt ? dayjs(runtimeOverview.updatedAt).valueOf() : Date.now()),
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
      (runtimeOverview?.samples ?? []).map((sample) => ({
        timestamp: dayjs(sample.timestamp).valueOf(),
        uploadRate: sample.uploadRate,
        downloadRate: sample.downloadRate,
      })),
    [runtimeOverview?.samples],
  )
  const chartRateDomain = useMemo(() => computeDynamicRateDomain(combinedChartData), [combinedChartData])

  return (
    <div className="flex flex-col gap-4">
      <Card
        withBorder
        shadow="sm"
        padding="none"
        className="overflow-hidden border-border/80 bg-card/90 backdrop-blur-sm"
      >
        <CardContent className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex items-center gap-3 xl:min-w-[250px] xl:basis-[250px]">
              <div className="rounded-full border border-primary/15 bg-primary/8 p-2 text-primary">
                <Radio className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg text-foreground">{t('trafficOverview.memoryMonitorTitle')}</CardTitle>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {t('shell.live')}
              </span>
            </div>

            <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MemoryMetricCard
                title={t('trafficOverview.rss')}
                amount={formatBytes(latestSample.rssBytes).split(' ')[0]}
                unit={formatBytes(latestSample.rssBytes).split(' ')[1] ?? ''}
                colorVar="var(--chart-4)"
              />
              <MemoryMetricCard
                title={t('trafficOverview.heapAlloc')}
                amount={formatBytes(latestSample.heapAllocBytes).split(' ')[0]}
                unit={formatBytes(latestSample.heapAllocBytes).split(' ')[1] ?? ''}
                colorVar="var(--chart-5)"
              />
              <MemoryMetricCard
                title={t('trafficOverview.goroutines')}
                amount={latestSample.goroutines.toString()}
                colorVar="var(--chart-3)"
              />
              <MemoryMetricCard
                title={t('trafficOverview.lastUpdated')}
                amount={formatClockTime(runtimeOverview?.updatedAt)}
                colorVar="var(--primary)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        withBorder
        shadow="sm"
        padding="none"
        className="overflow-hidden border-border/80 bg-card/90 backdrop-blur-sm"
      >
        <CardContent className="border-b border-border/70 px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex items-center gap-3 xl:min-w-[250px] xl:basis-[250px]">
              <div className="rounded-full border border-primary/15 bg-primary/8 p-2 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <CardTitle className="truncate text-lg text-foreground">{t('trafficOverview.title')}</CardTitle>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {t('shell.live')}
              </span>
            </div>
            <div className="grid flex-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <BannerMetricCard
                title={t('trafficOverview.totalUpload')}
                amount={formatBytes(latestSample.uploadTotal).split(' ')[0]}
                unit={formatBytes(latestSample.uploadTotal).split(' ')[1] ?? ''}
                colorVar="var(--chart-1)"
              />
              <BannerMetricCard
                title={t('trafficOverview.totalDownload')}
                amount={formatBytes(latestSample.downloadTotal).split(' ')[0]}
                unit={formatBytes(latestSample.downloadTotal).split(' ')[1] ?? ''}
                colorVar="var(--chart-2)"
              />
              <BannerMetricCard
                title={t('trafficOverview.activeConnections')}
                amount={latestSample.activeConnections.toString()}
                unit={t('trafficOverview.connectionsUnit')}
                colorVar="var(--primary)"
              />
              <BannerMetricCard
                title={t('trafficOverview.udpSessions')}
                amount={latestSample.udpSessions.toString()}
                unit={t('trafficOverview.sessionsUnit')}
                colorVar="var(--chart-3)"
              />
            </div>
          </div>
        </CardContent>

        <CardContent className="px-4 py-4 sm:px-5 sm:py-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-1)]" />
                  {t('trafficOverview.uploadLegend')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-2)]" />
                  {t('trafficOverview.downloadLegend')}
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

            <div className="rounded-[24px] border border-border/70 bg-background/72 p-4 shadow-sm">
              <ChartContainer config={chartConfig} className="h-[360px] w-full sm:h-[400px]">
                <AreaChart data={combinedChartData} margin={{ left: 4, right: 4, top: 4, bottom: 8 }}>
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
                    tickMargin={18}
                    height={34}
                    domain={[chartWindowStart, chartWindowEnd]}
                    allowDataOverflow
                    tickFormatter={(value) => dayjs(value).format('HH:mm')}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    width={60}
                    tickCount={5}
                    tickFormatter={(value) => formatAxisRate(Number(value))}
                    domain={chartRateDomain}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => dayjs(Number(value)).format('HH:mm:ss')}
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
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
