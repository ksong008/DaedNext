import { describe, expect, it } from 'vitest'

import { MockAPIClient } from './client'

describe('mock API client group resource mutations', () => {
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
