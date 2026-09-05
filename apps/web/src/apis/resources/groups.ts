import type { QueryClient } from '@tanstack/react-query'
import type {
  GroupListView,
  GroupResource,
  GroupSummaryListView,
  GroupSummaryResource,
  Policy,
  PolicyParam,
} from '../types'
import type { NodeAPI } from './nodes'
import type { CountResponse, ResourceWithID } from './shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { defaultResourcesAtom } from '~/store'
import { toID, toNumericID } from '../client'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { adaptNode } from './nodes'
import { useAuthenticatedQueryEnabled } from './shared'

export interface GroupAPI {
  id: number
  name: string
  version: number
  policy: string
  policyParams: Array<{ key?: string | null; val: string }>
  nodes: NodeAPI[]
  subscriptions: Array<{
    subscriptionId: number
    nameFilterRegex?: string | null
    matchedCount: number
    matchedNodes: NodeAPI[]
    updatedAt: string
    status: string
    info: string
    link: string
    tag?: string | null
  }>
}

export interface GroupSummaryAPI {
  id: number
  name: string
  policy: string
  policyParams: Array<{ key?: string | null; val: string }>
  version: number
  nodeCount: number
  subscriptionCount: number
  firstNode?: NodeAPI | null
  sampleNodes?: NodeAPI[] | null
  materializedCandidateCount?: number | null
  sampleMaterializedCandidates?: NodeAPI[] | null
  currentNode?: NodeAPI | null
  bestNode?: NodeAPI | null
  runtimeSelectedNode?: NodeAPI | null
  runtimeSelectedNetworkType?: string | null
  runtimeSelectedLatencyMs?: number | null
  runtimeSelectionSource?: string | null
  runtimeAliveCandidateCount?: number | null
  subscriptions: Array<{
    subscriptionId: number
    nameFilterRegex?: string | null
    matchedCount: number
    sampleMatchedNodes?: NodeAPI[] | null
    updatedAt: string
    status: string
    info: string
    link: string
    tag?: string | null
  }>
}

export function useGroupsSummaryQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.group.summary(),
    queryFn: async ({ signal }): Promise<GroupSummaryListView> => {
      const data = await apiClient.get<{ items: GroupSummaryAPI[] }>('/groups', { summary: true }, { signal })
      return {
        groups: data.items.map(adaptGroupSummary),
      }
    },
    enabled,
  })
}

export function useGroupsQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.group.expanded(),
    queryFn: async ({ signal }): Promise<GroupListView> => {
      const data = await apiClient.get<{ items: GroupAPI[] }>('/groups', undefined, { signal })
      return {
        groups: data.items.map(adaptGroup),
      }
    },
    enabled: queryEnabled,
  })
}

export function adaptGroup(group: GroupAPI): GroupResource {
  return {
    id: String(group.id),
    name: group.name,
    version: group.version,
    nodes: group.nodes.map(adaptNode),
    subscriptions: group.subscriptions.map((binding) => ({
      nameFilterRegex: binding.nameFilterRegex ?? null,
      matchedCount: binding.matchedCount,
      subscription: {
        id: String(binding.subscriptionId),
        updatedAt: binding.updatedAt,
        tag: binding.tag ?? null,
        status: binding.status,
        link: binding.link,
        info: binding.info,
      },
      matchedNodes: binding.matchedNodes.map(adaptNode),
    })),
    policy: group.policy as GroupResource['policy'],
    policyParams: group.policyParams.map(adaptPolicyParam),
  }
}

export function adaptGroupSummary(group: GroupSummaryAPI): GroupSummaryResource {
  return {
    id: String(group.id),
    name: group.name,
    policy: group.policy as GroupSummaryResource['policy'],
    policyParams: group.policyParams.map(adaptPolicyParam),
    version: group.version,
    nodeCount: group.nodeCount,
    subscriptionCount: group.subscriptionCount,
    firstNode: group.firstNode ? adaptNode(group.firstNode) : null,
    sampleNodes: (group.sampleNodes ?? []).map(adaptNode),
    materializedCandidateCount: group.materializedCandidateCount ?? group.nodeCount,
    sampleMaterializedCandidates: (group.sampleMaterializedCandidates ?? []).map(adaptNode),
    currentNode: group.currentNode ? adaptNode(group.currentNode) : null,
    bestNode: group.bestNode ? adaptNode(group.bestNode) : null,
    runtimeSelectedNode: group.runtimeSelectedNode ? adaptNode(group.runtimeSelectedNode) : null,
    runtimeSelectedNetworkType: group.runtimeSelectedNetworkType ?? null,
    runtimeSelectedLatencyMs: group.runtimeSelectedLatencyMs ?? null,
    runtimeSelectionSource: group.runtimeSelectionSource ?? null,
    runtimeAliveCandidateCount: group.runtimeAliveCandidateCount ?? null,
    subscriptions: group.subscriptions.map((subscription) => ({
      nameFilterRegex: subscription.nameFilterRegex ?? null,
      matchedCount: subscription.matchedCount,
      subscription: {
        id: String(subscription.subscriptionId),
        updatedAt: subscription.updatedAt,
        tag: subscription.tag ?? null,
        status: subscription.status,
        link: subscription.link,
        info: subscription.info,
      },
      sampleMatchedNodes: (subscription.sampleMatchedNodes ?? []).map(adaptNode),
    })),
  }
}

export function adaptPolicyParam(param: { key?: string | null; val: string }) {
  return {
    key: param.key ?? null,
    val: param.val,
  }
}

export interface RemoveGroupPayload {
  id: string
  defaultGroupID?: string
}

export function invalidateGroupResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

export function useCreateGroupMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      policy,
      policyParams,
    }: {
      name: string
      policy: Policy
      policyParams: PolicyParam[]
    }) => {
      const resource = await apiClient.post<ResourceWithID>('/groups', { name, policy, policyParams })
      return toID(resource.id)
    },
    onSuccess: () => {
      void invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useRemoveGroupMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, defaultGroupID }: RemoveGroupPayload) => {
      await apiClient.delete(`/groups/${id}`)
      const removedDefaultGroup = defaultGroupID === id
      if (removedDefaultGroup) {
        await apiClient.put<CountResponse>('/user/me/storage', {
          paths: ['defaultGroupID'],
          values: [''],
        })
      }
      return { id, removedDefaultGroup }
    },
    onSuccess: ({ removedDefaultGroup }) => {
      if (removedDefaultGroup) {
        defaultResourcesAtom.setKey('defaultGroupID', '')
      }
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
        webQueryKeys.general.state(),
        ...(removedDefaultGroup ? [webQueryKeys.storage()] : []),
      ])
    },
  })
}

export function useGroupSetPolicyMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, policy, policyParams }: { id: string; policy: Policy; policyParams: PolicyParam[] }) => {
      await apiClient.put(`/groups/${id}`, { policy, policyParams })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useRenameGroupMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/groups/${id}`, { name })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useGroupAddNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, nodeIDs }: { id: string; nodeIDs: string[] }) => {
      await apiClient.post(`/groups/${id}/nodes`, { nodeIds: nodeIDs.map(toNumericID) })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useGroupReplaceNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      nodeIDs,
      expectedVersion,
    }: {
      id: string
      nodeIDs: string[]
      expectedVersion: number
    }) => {
      await apiClient.put(`/groups/${id}/nodes`, {
        nodeIds: nodeIDs.map(toNumericID),
        expectedVersion,
      })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}

export function useGroupDelNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, nodeIDs }: { id: string; nodeIDs: string[] }) => {
      await apiClient.delete(`/groups/${id}/nodes`, { nodeIds: nodeIDs.map(toNumericID) })
    },
    onSuccess: async () => {
      await invalidateGroupResource(queryClient, { generalState: true })
    },
  })
}
