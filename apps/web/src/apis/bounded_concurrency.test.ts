import { describe, expect, it } from 'vitest'

import { mapWithConcurrency } from './bounded_concurrency'

describe('bounded API concurrency', () => {
  it('bounds active requests while preserving result order', async () => {
    let active = 0
    let maxActive = 0
    const result = await mapWithConcurrency([5, 4, 3, 2, 1], 2, async (value) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, value))
      active -= 1
      return value * 10
    })

    expect(maxActive).toBeLessThanOrEqual(2)
    expect(result).toEqual([50, 40, 30, 20, 10])
  })

  it('attempts every item before reporting aggregate failures', async () => {
    const attempted: number[] = []

    await expect(
      mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
        attempted.push(value)
        if (value === 2 || value === 4) throw new Error(`failed ${value}`)
        return value
      }),
    ).rejects.toThrow('2 bounded operation(s) failed')

    expect(attempted.sort()).toEqual([1, 2, 3, 4])
  })
})
