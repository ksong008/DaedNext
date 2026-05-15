export interface TrafficChartPoint {
  timestamp: number
  uploadRate: number
  downloadRate: number
}

const MIN_TRAFFIC_CHART_SPAN_MS = 1_000

export function computeTrafficChartDomain(
  data: TrafficChartPoint[],
  fallbackWindowEnd: number,
  windowSec: number,
): [number, number] {
  const windowMs = Math.max(windowSec, 1) * 1000
  const fallbackEnd = Number.isFinite(fallbackWindowEnd) ? fallbackWindowEnd : Date.now()
  const timestamps = data
    .map((sample) => sample.timestamp)
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => left - right)

  if (timestamps.length === 0) {
    return [fallbackEnd - windowMs, fallbackEnd]
  }

  const latestTimestamp = timestamps.at(-1)!
  const earliestAllowedTimestamp = latestTimestamp - windowMs
  const firstVisibleTimestamp = timestamps.find((timestamp) => timestamp >= earliestAllowedTimestamp) ?? latestTimestamp
  let domainStart = Math.max(firstVisibleTimestamp, earliestAllowedTimestamp)
  const domainEnd = latestTimestamp

  if (domainEnd - domainStart < MIN_TRAFFIC_CHART_SPAN_MS) {
    domainStart = domainEnd - Math.min(windowMs, MIN_TRAFFIC_CHART_SPAN_MS)
  }

  return [domainStart, domainEnd]
}

export function filterTrafficChartDataByDomain(data: TrafficChartPoint[], domain: [number, number]) {
  return data.filter((sample) => sample.timestamp >= domain[0] && sample.timestamp <= domain[1])
}
