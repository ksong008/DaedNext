import type {TrafficChartPoint} from './traffic_chart';
import { describe, expect, it } from 'vitest'
import { computeTrafficChartDomain, filterTrafficChartDataByDomain  } from './traffic_chart'

function point(timestamp: number): TrafficChartPoint {
  return { timestamp, uploadRate: timestamp, downloadRate: timestamp }
}

describe('traffic chart domain', () => {
  it('uses the requested full window when no samples are available', () => {
    expect(computeTrafficChartDomain([], 70_000, 60)).toEqual([10_000, 70_000])
  })

  it('fits short 1m sample ranges instead of leaving the left side empty', () => {
    expect(computeTrafficChartDomain([point(10_000), point(20_000)], 70_000, 60)).toEqual([10_000, 20_000])
  })

  it('keeps at most the selected window when older samples are present', () => {
    const data = [point(0), point(10_000), point(70_000)]
    const domain = computeTrafficChartDomain(data, 70_000, 60)

    expect(domain).toEqual([10_000, 70_000])
    expect(filterTrafficChartDataByDomain(data, domain)).toEqual([point(10_000), point(70_000)])
  })

  it('keeps a valid domain for a single sample', () => {
    expect(computeTrafficChartDomain([point(20_000)], 20_000, 60)).toEqual([19_000, 20_000])
  })

  it.each([
    { label: '10m', windowSec: 10 * 60, earlySample: 120_000, latestSample: 300_000 },
    { label: '30m', windowSec: 30 * 60, earlySample: 300_000, latestSample: 900_000 },
    { label: '1h', windowSec: 60 * 60, earlySample: 600_000, latestSample: 1_800_000 },
  ])(
    'fits short $label sample ranges instead of leaving empty chart space',
    ({ windowSec, earlySample, latestSample }) => {
      expect(computeTrafficChartDomain([point(earlySample), point(latestSample)], latestSample, windowSec)).toEqual([
        earlySample,
        latestSample,
      ])
    },
  )

  it.each([
    { label: '10m', windowSec: 10 * 60, oldSample: 0, windowStartSample: 200_000, latestSample: 800_000 },
    { label: '30m', windowSec: 30 * 60, oldSample: 0, windowStartSample: 400_000, latestSample: 2_200_000 },
    { label: '1h', windowSec: 60 * 60, oldSample: 0, windowStartSample: 600_000, latestSample: 4_200_000 },
  ])(
    'keeps at most the selected $label window when older samples are present',
    ({ windowSec, oldSample, windowStartSample, latestSample }) => {
      const data = [point(oldSample), point(windowStartSample), point(latestSample)]
      const domain = computeTrafficChartDomain(data, latestSample, windowSec)

      expect(domain).toEqual([windowStartSample, latestSample])
      expect(filterTrafficChartDataByDomain(data, domain)).toEqual([point(windowStartSample), point(latestSample)])
    },
  )
})
