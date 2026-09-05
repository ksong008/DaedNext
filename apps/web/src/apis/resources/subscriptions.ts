import type { QueryClient } from '@tanstack/react-query'
import type { SubscriptionResourceUpdate } from '../resource_updates'
import type {
  ImportArgument,
  NodeListView,
  SubscriptionListView,
  SubscriptionResource,
  SubscriptionSummaryListView,
  SubscriptionSummaryResource,
} from '../types'
import type { NodeListAPI } from './nodes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { mapWithConcurrency } from '../bounded_concurrency'
import { toID, toNumericID } from '../client'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { updateSubscriptionResource } from '../resource_updates'
import { invalidateChangedSubscriptionResources } from '../subscription_cache'
import { applyOptimisticSubscriptionDelete, restoreSubscriptionDeleteCache } from '../subscription_delete_cache'
import { importSubscriptions, SUBSCRIPTION_BULK_REQUEST_CONCURRENCY } from '../subscription_import'
import { invalidateGroupResource } from './groups'
import { adaptNodesConnection } from './nodes'
import { useAuthenticatedQueryEnabled } from './shared'

export interface SubscriptionAPI {
  id: number
  tag?: string | null
  status: string
  link: string
  info: string
  updatedAt: string
  cronExp: string
  cronEnable: boolean
  useProxy: boolean
  nodeCount: number
}

export function useSubscriptionBackedNodesQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.subscriptionBackedList(),
    queryFn: async ({ signal }): Promise<NodeListView> => {
      const data = await apiClient.get<NodeListAPI>('/nodes', { independent: false }, { signal })
      return {
        nodes: adaptNodesConnection(data),
      }
    },
    enabled: queryEnabled,
  })
}

export function useSubscriptionsSummaryQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.subscription.summary(),
    queryFn: async ({ signal }): Promise<SubscriptionSummaryListView> => {
      const data = await apiClient.get<{ items: SubscriptionAPI[] }>('/subscriptions', undefined, { signal })
      return {
        subscriptions: data.items.map(adaptSubscriptionSummary),
      }
    },
    enabled,
  })
}

export function useSubscriptionsQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.subscription.expanded(),
    queryFn: async ({ signal }): Promise<SubscriptionListView> => {
      const data = await apiClient.get<{ items: Array<SubscriptionAPI & { nodes?: NodeListAPI }> }>(
        '/subscriptions',
        {
          expand: 'nodes',
        },
        { signal },
      )
      const subscriptions = await Promise.all(
        data.items.map(async (subscription): Promise<SubscriptionResource> => {
          const nodes =
            subscription.nodes ??
            (await apiClient.get<NodeListAPI>(`/subscriptions/${subscription.id}/nodes`, undefined, { signal }))
          return {
            id: String(subscription.id),
            tag: subscription.tag ?? null,
            status: subscription.status,
            link: subscription.link,
            info: subscription.info,
            updatedAt: subscription.updatedAt,
            cronExp: subscription.cronExp,
            cronEnable: subscription.cronEnable,
            useProxy: subscription.useProxy,
            nodeCount: subscription.nodeCount,
            nodes: adaptNodesConnection(nodes),
          }
        }),
      )
      return { subscriptions }
    },
    enabled: queryEnabled,
  })
}

export function adaptSubscriptionSummary(subscription: SubscriptionAPI): SubscriptionSummaryResource {
  return {
    id: String(subscription.id),
    tag: subscription.tag ?? null,
    status: subscription.status,
    link: subscription.link,
    info: subscription.info,
    updatedAt: subscription.updatedAt,
    cronExp: subscription.cronExp,
    cronEnable: subscription.cronEnable,
    useProxy: subscription.useProxy,
    nodeCount: subscription.nodeCount,
  }
}

export function invalidateEditedSubscriptionResources(queryClient: QueryClient) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.subscription.summary(),
    webQueryKeys.subscription.expanded(),
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    webQueryKeys.general.state(),
  ])
}

export function useGroupAddSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      subscriptionIDs,
      nameFilterRegex,
    }: {
      id: string
      subscriptionIDs: string[]
      nameFilterRegex?: string | null
    }) => {
      await apiClient.post(`/groups/${id}/subscriptions`, {
        subscriptionIds: subscriptionIDs.map(toNumericID),
        nameFilterRegex: nameFilterRegex ?? null,
      })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useGroupDelSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, subscriptionIDs }: { id: string; subscriptionIDs: string[] }) => {
      await apiClient.delete(`/groups/${id}/subscriptions`, { subscriptionIds: subscriptionIDs.map(toNumericID) })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useImportSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ImportArgument[]) => importSubscriptions(apiClient, data),
    onSettled: () => {
      void invalidateChangedSubscriptionResources(queryClient)
    },
  })
}

export function useUpdateSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) =>
      mapWithConcurrency(ids, SUBSCRIPTION_BULK_REQUEST_CONCURRENCY, async (id) => {
        const subscription = await apiClient.post<{ id: number }>(`/subscriptions/${id}/refresh`)
        return toID(subscription.id)
      }),
    onSettled: () => {
      void invalidateChangedSubscriptionResources(queryClient)
    },
  })
}

export function useRemoveSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await apiClient.delete<{ removed: number }>('/subscriptions', { ids: ids.map(toNumericID) })
      return result.removed
    },
    onMutate: (ids) => applyOptimisticSubscriptionDelete(queryClient, ids),
    onError: (_error, _ids, snapshots) => {
      restoreSubscriptionDeleteCache(queryClient, snapshots)
    },
    onSettled: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.subscription.summary(),
        webQueryKeys.subscription.expanded(),
        webQueryKeys.node.subscriptionBackedList(),
        webQueryKeys.node.latency(),
        webQueryKeys.node.latencyJob(),
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
        webQueryKeys.general.state(),
      ])
    },
  })
}

export function useUpdateSubscriptionMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (update: SubscriptionResourceUpdate) => updateSubscriptionResource(apiClient, update),
    onSuccess: () => {
      void invalidateEditedSubscriptionResources(queryClient)
    },
  })
}
