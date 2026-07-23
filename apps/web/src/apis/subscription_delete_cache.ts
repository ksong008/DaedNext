import type { QueryClient } from '@tanstack/react-query'
import type { NodeLatencyProbeResult, NodeListView, SubscriptionListView, SubscriptionSummaryListView } from './types'

import { webQueryKeys } from './query_cache'

const optimisticSubscriptionDeleteKeys = [
  webQueryKeys.subscription.summary(),
  webQueryKeys.subscription.expanded(),
  webQueryKeys.node.subscriptionBackedList(),
  webQueryKeys.node.latency(),
] as const

interface SubscriptionDeleteCacheSnapshot {
  queryKey: readonly unknown[]
  value: unknown
}

export async function applyOptimisticSubscriptionDelete(queryClient: QueryClient, ids: string[]) {
  await Promise.all(
    optimisticSubscriptionDeleteKeys.map((queryKey) => queryClient.cancelQueries({ queryKey, exact: true })),
  )
  const snapshots = optimisticSubscriptionDeleteKeys.map(
    (queryKey): SubscriptionDeleteCacheSnapshot => ({
      queryKey,
      value: queryClient.getQueryData(queryKey),
    }),
  )
  pruneDeletedSubscriptionResources(queryClient, ids)
  return snapshots
}

export function restoreSubscriptionDeleteCache(
  queryClient: QueryClient,
  snapshots: SubscriptionDeleteCacheSnapshot[] | undefined,
) {
  for (const snapshot of snapshots ?? []) {
    queryClient.setQueryData(snapshot.queryKey, snapshot.value)
  }
}

function pruneDeletedSubscriptionResources(queryClient: QueryClient, ids: string[]) {
  const deletedSubscriptionIds = new Set(ids)
  const removedNodeIds = new Set<string>()

  queryClient.setQueryData<SubscriptionSummaryListView | undefined>(webQueryKeys.subscription.summary(), (current) =>
    current
      ? {
          ...current,
          subscriptions: current.subscriptions.filter((subscription) => !deletedSubscriptionIds.has(subscription.id)),
        }
      : current,
  )
  queryClient.setQueryData<SubscriptionListView | undefined>(webQueryKeys.subscription.expanded(), (current) =>
    current
      ? {
          ...current,
          subscriptions: current.subscriptions.filter((subscription) => !deletedSubscriptionIds.has(subscription.id)),
        }
      : current,
  )
  queryClient.setQueryData<NodeListView | undefined>(webQueryKeys.node.subscriptionBackedList(), (current) => {
    if (!current) return current

    const nodes = current.nodes.items.filter((node) => {
      if (node.subscriptionID && deletedSubscriptionIds.has(node.subscriptionID)) {
        removedNodeIds.add(node.id)
        return false
      }
      return true
    })

    return {
      ...current,
      nodes: {
        ...current.nodes,
        items: nodes,
        totalCount: nodes.length,
      },
    }
  })
  if (removedNodeIds.size > 0) {
    queryClient.setQueryData<NodeLatencyProbeResult[] | undefined>(webQueryKeys.node.latency(), (current) =>
      current?.filter((result) => !removedNodeIds.has(result.id)),
    )
  }
}
