import { describe, expect, it, vi } from 'vitest'
import { invalidateChangedSubscriptionResources } from './subscription_cache'

describe('invalidateChangedSubscriptionResources', () => {
  it('refreshes subscription nodes and their latency-dependent views after partial changes', async () => {
    const invalidated: unknown[][] = []
    const invalidateQueries = vi.fn(async ({ queryKey }: { queryKey: unknown[] }) => {
      invalidated.push(queryKey)
    })

    await invalidateChangedSubscriptionResources({ invalidateQueries: invalidateQueries as never })

    expect(invalidated).toEqual([
      ['subscription', 'summary'],
      ['subscription', 'expanded'],
      ['node', 'subscription-backed'],
      ['nodeLatency'],
      ['group', 'summary'],
      ['group', 'expanded'],
      ['general', 'state'],
    ])
  })
})
