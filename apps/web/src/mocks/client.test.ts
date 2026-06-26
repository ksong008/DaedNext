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
        subscriptions: Array<{ matchedNodes?: unknown; sampleMatchedNodes?: Array<{ name: string }> }>
      }>
    }>('/groups', { summary: true })
    expect(groups.items[0]?.nodeCount).toBeGreaterThanOrEqual(0)
    expect(groups.items[0]?.subscriptionCount).toBeGreaterThanOrEqual(0)
    expect(groups.items[0]?.nodes).toBeUndefined()
    expect(groups.items[0]?.subscriptions.length).toBeGreaterThanOrEqual(0)
    expect(groups.items[0]?.subscriptions[0]?.matchedNodes).toBeUndefined()
    expect(groups.items[0]).not.toHaveProperty('firstSubscription')
  })

  it('exports mock bundles and dae config files from current mock resources', async () => {
    const client = new MockAPIClient('')

    const bundle = await client.get<{
      configs: Array<{ global: string }>
      groups: Array<{ name: string; policy: string }>
    }>('/user/me/dae-bundle')
    expect(bundle.configs[0]?.global).toContain('global {')
    expect(bundle.configs[0]?.global).toContain('log_level: error')
    expect(bundle.configs[0]?.global).not.toBe('global {}')
    expect(bundle.groups[0]).toMatchObject({ name: 'default', policy: 'random' })

    const exported = await client.get<{ content: string }>('/user/me/dae-config-file')
    expect(exported.content).toContain('log_level: error')
    expect(exported.content).toContain('subscription {')
    expect(exported.content).toContain("'Premium Provider': 'https://example.com/api/v1/client/subscribe?token=xxxxx'")
    expect(exported.content).toContain('node {')
    expect(exported.content).toContain("JP-Tokyo-Premium: 'vmess://")
    expect(exported.content).toContain('policy: random')
    expect(exported.content).toContain('fallback: default')
    expect(exported.content).not.toContain('log_level: "info"')
    expect(exported.content).not.toContain('fallback: proxy')
    expect(exported.content).not.toContain('} as any')
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
    const defaultGroup = groups.items.find((group) => group.id === 1)

    expect(defaultGroup?.nodes.some((node) => node.id === 3)).toBe(true)
    expect(
      defaultGroup?.subscriptions.some(
        (subscription) =>
          subscription.subscriptionId === 2 &&
          subscription.matchedCount === 1 &&
          subscription.matchedNodes[0]?.name === 'Germany-Backup-03',
      ),
    ).toBe(true)
  })

  it('recomputes regex subscription bindings from refreshed subscription nodes', async () => {
    const client = new MockAPIClient('')

    await client.post('/groups/2/subscriptions', {
      subscriptionIds: [2],
      nameFilterRegex: 'Refresh',
    })

    const beforeRefresh = await client.get<{
      items: Array<{
        id: number
        subscriptions: Array<{
          subscriptionId: number
          matchedCount: number
          matchedNodes: Array<{ name: string }>
        }>
      }>
    }>('/groups')
    const groupBeforeRefresh = beforeRefresh.items.find((group) => group.id === 2)
    const bindingBeforeRefresh = groupBeforeRefresh?.subscriptions.find(
      (subscription) => subscription.subscriptionId === 2,
    )
    expect(bindingBeforeRefresh?.matchedCount).toBe(0)

    await client.post('/subscriptions/2/refresh')

    const afterRefresh = await client.get<{
      items: Array<{
        id: number
        subscriptions: Array<{
          subscriptionId: number
          matchedCount: number
          matchedNodes: Array<{ name: string }>
        }>
      }>
    }>('/groups')
    const groupAfterRefresh = afterRefresh.items.find((group) => group.id === 2)
    const bindingAfterRefresh = groupAfterRefresh?.subscriptions.find(
      (subscription) => subscription.subscriptionId === 2,
    )

    expect(bindingAfterRefresh?.matchedCount).toBe(1)
    expect(bindingAfterRefresh?.matchedNodes[0]?.name).toContain('Refresh')
  })
})
