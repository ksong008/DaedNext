import type { NodeListView, SubscriptionListView, SubscriptionSummaryListView } from './types'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { webQueryKeys } from './query_cache'
import { applyOptimisticSubscriptionDelete, restoreSubscriptionDeleteCache } from './subscription_delete_cache'

describe('subscription delete cache', () => {
  it('removes subscription-backed resources immediately and restores them on failure', async () => {
    const queryClient = new QueryClient()
    const summary = {
      subscriptions: [{ id: '7' }, { id: '8' }],
    } as SubscriptionSummaryListView
    const expanded = {
      subscriptions: [{ id: '7' }, { id: '8' }],
    } as SubscriptionListView
    const nodes = {
      nodes: {
        items: [
          { id: '70', subscriptionID: '7' },
          { id: '80', subscriptionID: '8' },
        ],
        totalCount: 2,
      },
    } as NodeListView
    const latencies = [
      { id: '70', alive: true },
      { id: '80', alive: true },
    ]
    queryClient.setQueryData(webQueryKeys.subscription.summary(), summary)
    queryClient.setQueryData(webQueryKeys.subscription.expanded(), expanded)
    queryClient.setQueryData(webQueryKeys.node.subscriptionBackedList(), nodes)
    queryClient.setQueryData(webQueryKeys.node.latency(), latencies)

    const snapshot = await applyOptimisticSubscriptionDelete(queryClient, ['7'])

    expect(
      queryClient
        .getQueryData<SubscriptionSummaryListView>(webQueryKeys.subscription.summary())
        ?.subscriptions.map(({ id }) => id),
    ).toEqual(['8'])
    expect(
      queryClient
        .getQueryData<NodeListView>(webQueryKeys.node.subscriptionBackedList())
        ?.nodes.items.map(({ id }) => id),
    ).toEqual(['80'])
    expect(queryClient.getQueryData<Array<{ id: string }>>(webQueryKeys.node.latency())?.map(({ id }) => id)).toEqual([
      '80',
    ])

    restoreSubscriptionDeleteCache(queryClient, snapshot)

    expect(queryClient.getQueryData(webQueryKeys.subscription.summary())).toEqual(summary)
    expect(queryClient.getQueryData(webQueryKeys.subscription.expanded())).toEqual(expanded)
    expect(queryClient.getQueryData(webQueryKeys.node.subscriptionBackedList())).toEqual(nodes)
    expect(queryClient.getQueryData(webQueryKeys.node.latency())).toEqual(latencies)
  })
})
