import type { QueryClient } from '@tanstack/react-query'
import type { ImportArgument, NodeCollection, NodeListView, NodeResource } from '../types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { toID, toNumericID } from '../client'
import { resolveNodeTransport } from '../node_transport'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { useAuthenticatedQueryEnabled } from './shared'

export interface NodeAPI {
  id: number
  link: string
  name: string
  address: string
  protocol: string
  transport?: string | null
  tag?: string | null
  subscriptionId?: number | null
}

export interface NodeListAPI {
  items: NodeAPI[]
  totalCount: number
  nextAfterId?: number | null
}

export function useNodesQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.list(),
    queryFn: async ({ signal }): Promise<NodeListView> => {
      const data = await apiClient.get<NodeListAPI>('/nodes', undefined, { signal })
      return {
        nodes: adaptNodesConnection(data),
      }
    },
    enabled: queryEnabled,
  })
}

export function adaptNodesConnection(data: NodeListAPI): NodeCollection {
  const items = data.items.map(adaptNode)
  return {
    totalCount: data.totalCount,
    items,
  }
}

export function adaptNode(node: NodeAPI): NodeResource {
  return {
    id: String(node.id),
    link: node.link,
    name: node.name,
    address: node.address,
    protocol: node.protocol,
    transport: resolveNodeTransport(node.link, node.protocol, node.transport),
    tag: node.tag ?? null,
    subscriptionID: node.subscriptionId ? String(node.subscriptionId) : null,
  }
}

export interface NodeImportListResponse {
  items: Array<{
    link: string
    error?: string | null
    node?: { id: number } | null
  }>
}

export function invalidateNodeResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.node.list(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

export function useImportNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ImportArgument[]) => {
      const result = await apiClient.post<NodeImportListResponse>('/nodes', {
        rollbackError: false,
        args: data,
      })
      return result.items.map((item) => ({
        link: item.link,
        error: item.error ?? null,
        node: item.node ? { id: toID(item.node.id) } : null,
      }))
    },
    onSuccess: () => {
      void invalidateNodeResource(queryClient, { generalState: true })
    },
  })
}

export function useRemoveNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await apiClient.delete<{ removed: number }>('/nodes', { ids: ids.map(toNumericID) })
      return result.removed
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.node.list(),
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
        webQueryKeys.general.state(),
      ])
    },
  })
}

export function useUpdateNodeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, newLink }: { id: string; newLink: string }) => {
      const node = await apiClient.put<{ id: number; name: string; tag?: string | null; link: string }>(
        `/nodes/${id}`,
        {
          link: newLink,
        },
      )
      return {
        id: toID(node.id),
        name: node.name,
        tag: node.tag ?? null,
        link: node.link,
      }
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.node.list(),
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
        webQueryKeys.general.state(),
      ])
    },
  })
}

export function useTagNodeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      await apiClient.put(`/nodes/${id}`, { tag })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.node.list(),
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
      ])
    },
  })
}
