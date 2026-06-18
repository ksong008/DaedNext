import { describe, expect, it } from 'vitest'

import { MockAPIClient } from './client'

describe('mock API client group resource mutations', () => {
  it('returns resource counts from general state without loading full resource lists', async () => {
    const client = new MockAPIClient('')

    const state = await client.get<{
      counts: {
        configs: number
        dns: number
        routings: number
        groups: number
        nodes: number
        subscriptions: number
        logs: number
      }
    }>('/general/state')

    expect(state.counts.configs).toBeGreaterThan(0)
    expect(state.counts.dns).toBeGreaterThan(0)
    expect(state.counts.routings).toBeGreaterThan(0)
    expect(state.counts.groups).toBeGreaterThan(0)
    expect(state.counts.nodes).toBeGreaterThan(0)
    expect(state.counts.subscriptions).toBeGreaterThan(0)
  })

  it('uses the latency job response shape for manual node tests', async () => {
    const client = new MockAPIClient('')

    const response = await client.post<{
      items: Array<{ id: string; alive: boolean }>
      job: { id: number; status: string; total: number; completed: number }
    }>('/nodes/latencies')

    expect(response.items.length).toBeGreaterThan(0)
    expect(response.job.status).toBe('finished')
    expect(response.job.completed).toBe(response.job.total)

    const jobResponse = await client.get<{ job: { id: number; status: string } | null }>('/nodes/latencies/job')
    expect(jobResponse.job?.id).toBe(response.job.id)
    expect(jobResponse.job?.status).toBe('finished')
  })

  it('serves lightweight section and group summaries without full resource expansion', async () => {
    const client = new MockAPIClient('')

    const configs = await client.get<{
      items: Array<{ id: number; name: string; selected: boolean; global?: unknown; parsedGlobal?: unknown }>
    }>('/configs', { summary: true })
    expect(configs.items[0]?.name).toBeTruthy()
    expect(configs.items[0]?.global).toBeUndefined()
    expect(configs.items[0]?.parsedGlobal).toBeUndefined()

    const groups = await client.get<{
      items: Array<{
        id: number
        nodeCount: number
        subscriptionCount: number
        nodes?: unknown
        subscriptions?: unknown
        firstSubscription?: { matchedNodes?: unknown; sampleMatchedNodes?: Array<{ name: string }> } | null
      }>
    }>('/groups', { summary: true })
    expect(groups.items[0]?.nodeCount).toBeGreaterThanOrEqual(0)
    expect(groups.items[0]?.subscriptionCount).toBeGreaterThanOrEqual(0)
    expect(groups.items[0]?.nodes).toBeUndefined()
    expect(groups.items[0]?.subscriptions).toBeUndefined()
    expect(groups.items[0]?.firstSubscription?.matchedNodes).toBeUndefined()
  })

  it('persists group node and subscription changes for local UI validation', async () => {
    const client = new MockAPIClient('')

    await client.post('/groups/1/nodes', { nodeIds: [3] })
    await client.post('/groups/1/subscriptions', {
      subscriptionIds: [2],
      nameFilterRegex: 'Germany',
    })

    const groups = await client.get<{
      items: Array<{
        id: number
        nodes: Array<{ id: number }>
        subscriptions: Array<{
          subscriptionId: number
          matchedCount: number
          matchedNodes: Array<{ name: string }>
        }>
      }>
    }>('/groups')
    const proxy = groups.items.find((group) => group.id === 1)

    expect(proxy?.nodes.some((node) => node.id === 3)).toBe(true)
    expect(
      proxy?.subscriptions.some(
        (subscription) =>
          subscription.subscriptionId === 2 &&
          subscription.matchedCount === 1 &&
          subscription.matchedNodes[0]?.name === 'Germany-Backup-03',
      ),
    ).toBe(true)
  })
})
