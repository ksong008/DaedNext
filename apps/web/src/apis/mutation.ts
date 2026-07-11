import type { QueryClient } from '@tanstack/react-query'

import type {
  ConfigPreviewResult,
  DAEBundle,
  DAEConfigFileExportResult,
  DAEConfigFileImportResult,
  DAEConfigFilePreviewResult,
  GeodataKind,
  GeodataSettingsView,
  GeodataSourceResource,
  GeodataUpdateResult,
  GeodataView,
  GlobalInput,
  ImportArgument,
  LogSettings,
  NodeLatencyProbeResponse,
  NodeLatencyProbeResult,
  NodeListView,
  Policy,
  PolicyParam,
  SubscriptionListView,
  SubscriptionSummaryListView,
} from './types'
import type { MODE } from '~/constants'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAPIClient } from '~/contexts'
import { defaultResourcesAtom } from '~/store'
import { mapWithConcurrency } from './bounded_concurrency'
import { toID, toNumericID } from './client'
import { selectProfileResources } from './profile_selection'
import { adaptNodeLatencyJob, adaptNodeLatencyProbeResults } from './query'
import { invalidateQueryKeys, webQueryKeys } from './query_cache'
import { invalidateChangedSubscriptionResources } from './subscription_cache'

interface CountResponse {
  updated?: number
  removed?: number
}

interface ResourceWithID {
  id: number
}

interface RemoveGroupPayload {
  id: string
  defaultGroupID?: string
}

interface TokenResponse {
  token: string
}

const SUBSCRIPTION_BULK_REQUEST_CONCURRENCY = 4

interface SubscriptionImportResponse {
  link: string
  error?: string | null
  subscriptionCreated: boolean
  importedNodeCount: number
  failedNodeCount: number
  partialFailure: boolean
  nodeImportResult: Array<{
    link: string
    error?: string | null
    node?: { id: number } | null
  }>
  subscription: {
    id: number
  }
}

interface NodeImportListResponse {
  items: Array<{
    link: string
    error?: string | null
    node?: { id: number } | null
  }>
}

function invalidateDefaultResourceSetup(queryClient: QueryClient) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.config.summary(),
    webQueryKeys.config.expanded(),
    webQueryKeys.dns.summary(),
    webQueryKeys.dns.expanded(),
    webQueryKeys.routing.summary(),
    webQueryKeys.routing.expanded(),
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    webQueryKeys.general.state(),
    webQueryKeys.storage(),
  ])
}

function invalidateImportedProductGraph(queryClient: QueryClient) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.config.summary(),
    webQueryKeys.config.expanded(),
    webQueryKeys.config.item(),
    webQueryKeys.dns.summary(),
    webQueryKeys.dns.expanded(),
    webQueryKeys.routing.summary(),
    webQueryKeys.routing.expanded(),
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    webQueryKeys.node.list(),
    webQueryKeys.subscription.summary(),
    webQueryKeys.subscription.expanded(),
    webQueryKeys.general.state(),
    webQueryKeys.storage(),
    webQueryKeys.user(),
  ])
}

function invalidateConfigResource(
  queryClient: QueryClient,
  {
    allItems = false,
    expanded = true,
    generalState = false,
    itemId,
  }: {
    allItems?: boolean
    expanded?: boolean
    generalState?: boolean
    itemId?: string | null
  } = {},
) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.config.summary(),
    ...(expanded ? [webQueryKeys.config.expanded()] : []),
    ...(allItems || itemId !== undefined ? [webQueryKeys.config.item(itemId)] : []),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

function invalidateRoutingResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.routing.summary(),
    webQueryKeys.routing.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

function invalidateDNSResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.dns.summary(),
    webQueryKeys.dns.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

function invalidateGroupResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

function invalidateNodeResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.node.list(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

function invalidateSubscriptionResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.subscription.summary(),
    webQueryKeys.subscription.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
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

export function useSetJsonStorageMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (object: Record<string, string>) => {
      const paths = Object.keys(object)
      const values = paths.map((path) => object[path])
      const response = await apiClient.put<CountResponse>('/user/me/storage', { paths, values })
      return response.updated ?? 0
    },
  })
}

export function useSetModeMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (mode: MODE) => {
      const response = await apiClient.put<CountResponse>('/user/me/storage', {
        paths: ['mode'],
        values: [mode],
      })
      return response.updated ?? 0
    },
  })
}

export function useEnsureDefaultResourcesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      configName,
      global,
      dnsName,
      dns,
      routingName,
      routing,
      groupName,
      policy,
      policyParams,
      mode,
    }: {
      configName: string
      global: GlobalInput
      dnsName: string
      dns: string
      routingName: string
      routing: string
      groupName?: string
      policy?: Policy
      policyParams?: PolicyParam[]
      mode: string
    }) => {
      const ensured = await apiClient.post<{
        defaultConfigID: string
        defaultRoutingID: string
        defaultDNSID: string
        defaultGroupID: string
        mode: string
      }>('/user/me/default-resources', {
        configName,
        global,
        dnsName,
        dns,
        routingName,
        routing,
        groupName,
        policy,
        policyParams,
        mode,
      })

      return ensured
    },
    onSuccess: () => {
      void invalidateDefaultResourceSetup(queryClient)
    },
  })
}

export function useCreateConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      global,
      parsedGlobal,
    }: {
      name?: string
      global?: string
      parsedGlobal?: GlobalInput
    }) => {
      const resource = await apiClient.post<ResourceWithID>('/configs', { name, global, parsedGlobal })
      return toID(resource.id)
    },
    onSuccess: () => {
      void invalidateConfigResource(queryClient, { generalState: true })
    },
  })
}

export function useUpdateConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, global, parsedGlobal }: { id: string; global?: string; parsedGlobal?: GlobalInput }) => {
      const resource = await apiClient.put<ResourceWithID>(`/configs/${id}`, { global, parsedGlobal })
      return toID(resource.id)
    },
    onSuccess: (_result, { id }) => {
      void invalidateConfigResource(queryClient, { generalState: true, itemId: id })
    },
  })
}

export function usePreviewConfigMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({
      global,
      parsedGlobal,
    }: {
      global?: string
      parsedGlobal?: GlobalInput
    }): Promise<ConfigPreviewResult> => {
      return apiClient.post<ConfigPreviewResult>('/configs/parsed', { global, parsedGlobal })
    },
  })
}

export function useExportDAEBundleMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (): Promise<DAEBundle> => {
      return apiClient.get<DAEBundle>('/user/me/dae-bundle')
    },
  })
}

export function useImportDAEBundleMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bundle: DAEBundle) => {
      return apiClient.put<{ imported: boolean }>('/user/me/dae-bundle', bundle)
    },
    onSuccess: () => {
      void invalidateImportedProductGraph(queryClient)
    },
  })
}

export function useExportDAEConfigFileMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (): Promise<DAEConfigFileExportResult> => {
      return apiClient.get<DAEConfigFileExportResult>('/user/me/dae-config-file')
    },
  })
}

export function useImportDAEConfigFileMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      filename,
      namePrefix,
      content,
    }: {
      filename?: string
      namePrefix?: string
      content: string
    }) => {
      return apiClient.put<DAEConfigFileImportResult>('/user/me/dae-config-file', { filename, namePrefix, content })
    },
    onSuccess: () => {
      void invalidateImportedProductGraph(queryClient)
    },
  })
}

export function usePreviewDAEConfigFileMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({
      filename,
      namePrefix,
      content,
    }: {
      filename?: string
      namePrefix?: string
      content: string
    }) => {
      return apiClient.post<DAEConfigFilePreviewResult>('/user/me/dae-config-file/preview', {
        filename,
        namePrefix,
        content,
      })
    },
  })
}

export function useRemoveConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/configs/${id}`)
    },
    onSuccess: (_result, id) => {
      void invalidateConfigResource(queryClient, { generalState: true, itemId: id })
    },
  })
}

export function useSelectConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/configs/${id}/select`)
    },
    onSuccess: () => {
      void invalidateConfigResource(queryClient, { allItems: true, generalState: true })
    },
  })
}

export function useSelectProfileMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (selection: { configID: string; dnsID: string; routingID: string }) =>
      selectProfileResources(apiClient, selection),
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.config.summary(),
        webQueryKeys.config.expanded(),
        webQueryKeys.config.item(),
        webQueryKeys.dns.summary(),
        webQueryKeys.dns.expanded(),
        webQueryKeys.routing.summary(),
        webQueryKeys.routing.expanded(),
        webQueryKeys.general.state(),
      ])
    },
  })
}

export function useRenameConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/configs/${id}`, { name })
    },
    onSuccess: (_result, { id }) => {
      void invalidateConfigResource(queryClient, { itemId: id })
    },
  })
}

export function useCreateRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, routing }: { name?: string; routing?: string }) => {
      const resource = await apiClient.post<ResourceWithID>('/routings', { name, routing })
      return toID(resource.id)
    },
    onSuccess: () => {
      void invalidateRoutingResource(queryClient, { generalState: true })
    },
  })
}

export function useUpdateRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, routing }: { id: string; routing: string }) => {
      const resource = await apiClient.put<ResourceWithID>(`/routings/${id}`, { routing })
      return toID(resource.id)
    },
    onSuccess: () => {
      void invalidateRoutingResource(queryClient, { generalState: true })
    },
  })
}

export function useRemoveRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/routings/${id}`)
    },
    onSuccess: () => {
      void invalidateRoutingResource(queryClient, { generalState: true })
    },
  })
}

export function useSelectRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/routings/${id}/select`)
    },
    onSuccess: () => {
      void invalidateRoutingResource(queryClient, { generalState: true })
    },
  })
}

export function useRenameRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/routings/${id}`, { name })
    },
    onSuccess: () => {
      void invalidateRoutingResource(queryClient, { generalState: true })
    },
  })
}

export function useCreateDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, dns }: { name?: string; dns?: string }) => {
      const resource = await apiClient.post<ResourceWithID>('/dns', { name, dns })
      return toID(resource.id)
    },
    onSuccess: () => {
      void invalidateDNSResource(queryClient, { generalState: true })
    },
  })
}

export function useUpdateDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, dns }: { id: string; dns: string }) => {
      const resource = await apiClient.put<ResourceWithID>(`/dns/${id}`, { dns })
      return toID(resource.id)
    },
    onSuccess: () => {
      void invalidateDNSResource(queryClient, { generalState: true })
    },
  })
}

export function useRemoveDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/dns/${id}`)
    },
    onSuccess: () => {
      void invalidateDNSResource(queryClient, { generalState: true })
    },
  })
}

export function useSelectDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/dns/${id}/select`)
    },
    onSuccess: () => {
      void invalidateDNSResource(queryClient, { generalState: true })
    },
  })
}

export function useRenameDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/dns/${id}`, { name })
    },
    onSuccess: () => {
      void invalidateDNSResource(queryClient)
    },
  })
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

export function useImportSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ImportArgument[]) =>
      mapWithConcurrency(data, SUBSCRIPTION_BULK_REQUEST_CONCURRENCY, async (subscription) => {
        const result = await apiClient.post<SubscriptionImportResponse>('/subscriptions', {
          rollbackError: false,
          link: subscription.link,
          tag: subscription.tag ?? null,
          useProxy: subscription.useProxy ?? false,
        })
        return {
          link: result.link,
          error: result.error ?? null,
          subscriptionCreated: result.subscriptionCreated,
          importedNodeCount: result.importedNodeCount,
          failedNodeCount: result.failedNodeCount,
          partialFailure: result.partialFailure,
          subscription: {
            id: toID(result.subscription.id),
          },
          nodeImportResult: result.nodeImportResult.map((item) => ({
            link: item.link,
            error: item.error ?? null,
            node: item.node ? { id: toID(item.node.id) } : null,
          })),
        }
      }),
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

export function useUpdateGeodataMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (kind: GeodataKind) => apiClient.post<GeodataUpdateResult>(`/geodata/${kind}/update`),
    onSuccess: (result) => {
      const updatedResource = result[result.updated]
      if (updatedResource) {
        queryClient.setQueryData<GeodataView | undefined>(webQueryKeys.geodata.status(), (current) =>
          current ? { ...current, [result.updated]: updatedResource } : current,
        )
      } else {
        void invalidateQueryKeys(queryClient, [webQueryKeys.geodata.status()])
      }
      void invalidateQueryKeys(queryClient, [webQueryKeys.general.state()])
    },
  })
}

export function useUpdateGeodataSourceMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      kind,
      url,
      restoreDefault,
      useProxy,
    }: {
      kind: GeodataKind
      url?: string
      restoreDefault?: boolean
      useProxy?: boolean
    }) =>
      apiClient.patch<GeodataSourceResource>(
        `/geodata/${kind}/settings`,
        restoreDefault ? { restoreDefault: true, useProxy } : { url: url ?? '', useProxy },
      ),
    onSuccess: (source) => {
      queryClient.setQueryData<GeodataSettingsView | undefined>(webQueryKeys.geodata.settings(), (current) =>
        current ? { ...current, [source.kind]: source } : current,
      )
    },
  })
}

export function useTestNodeLatenciesMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({
      ids,
      signal,
      timeoutMs,
    }: { ids?: string[]; signal?: AbortSignal; timeoutMs?: number } = {}) => {
      const data = await apiClient.post<{
        items: Parameters<typeof adaptNodeLatencyProbeResults>[0]
        job?: Parameters<typeof adaptNodeLatencyJob>[0]
      }>('/nodes/latencies', ids && ids.length > 0 ? { ids: ids.map(toNumericID) } : {}, undefined, {
        signal,
        timeoutMs,
      })

      return {
        items: adaptNodeLatencyProbeResults(data.items),
        job: adaptNodeLatencyJob(data.job),
      } satisfies NodeLatencyProbeResponse
    },
  })
}

export function useCancelNodeLatencyJobMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const data = await apiClient.delete<{
        job?: Parameters<typeof adaptNodeLatencyJob>[0]
      }>('/nodes/latencies/job', { id: toNumericID(jobId) })
      return adaptNodeLatencyJob(data.job)
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
    onSuccess: (_removed, ids) => {
      pruneDeletedSubscriptionResources(queryClient, ids)
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

export function useReloadRuntimeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dry = false }: { dry?: boolean } = {}) => {
      const result = await apiClient.post<{ applied: number }>('/runtime/reload', { dry })
      return result.applied
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.general.state(), webQueryKeys.log.items()])
    },
  })
}

export function useStopRuntimeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.post<{ stopped: boolean }>('/runtime/stop', {})
      return result.stopped
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.general.state(), webQueryKeys.log.items()])
    },
  })
}

export function useSetRuntimeLogLevelMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (level: string) => {
      return apiClient.patch<{ level: string }>('/runtime/log-level', { level })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.log.runtimeLevel(), webQueryKeys.log.items()])
    },
  })
}

export function useClearLogsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiClient.delete<{ cleared: boolean }>('/logs')
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.log.items()])
    },
  })
}

export function useUpdateLogSettingsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Pick<LogSettings, 'maxEntries' | 'maxBytes'>) => {
      return apiClient.patch<LogSettings>('/logs/settings', settings)
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.log.settings()])
    },
  })
}

export function useUpdateAvatarMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (avatar: string) => {
      return apiClient.patch('/user/me', { avatar })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.user()])
    },
  })
}

export function useUpdateNameMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      return apiClient.patch('/user/me', { name })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.user()])
    },
  })
}

export function useUpdatePasswordMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const response = await apiClient.post<TokenResponse>('/user/me/password', {
        currentPassword,
        newPassword,
      })
      return response.token
    },
  })
}

export function useUpdateUsernameMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (username: string) => {
      return apiClient.patch('/user/me', { username })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.user()])
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

export function useTagSubscriptionMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      await apiClient.put(`/subscriptions/${id}`, { tag })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.subscription.summary(),
        webQueryKeys.subscription.expanded(),
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
      ])
    },
  })
}

export function useUpdateSubscriptionLinkMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, link }: { id: string; link: string }) => {
      const subscription = await apiClient.put<{ id: number; link: string; tag?: string | null }>(
        `/subscriptions/${id}`,
        {
          link,
        },
      )
      return {
        id: toID(subscription.id),
        link: subscription.link,
        tag: subscription.tag ?? null,
      }
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.subscription.summary(),
        webQueryKeys.subscription.expanded(),
        webQueryKeys.group.summary(),
        webQueryKeys.group.expanded(),
      ])
    },
  })
}

export function useUpdateSubscriptionCronMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, cronExp, cronEnable }: { id: string; cronExp: string; cronEnable: boolean }) => {
      const subscription = await apiClient.put<{ id: number; cronExp: string; cronEnable: boolean }>(
        `/subscriptions/${id}`,
        { cronExp, cronEnable },
      )
      return {
        id: toID(subscription.id),
        cronExp: subscription.cronExp,
        cronEnable: subscription.cronEnable,
      }
    },
    onSuccess: () => {
      void invalidateSubscriptionResource(queryClient)
    },
  })
}

export function useUpdateSubscriptionUseProxyMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, useProxy }: { id: string; useProxy: boolean }) => {
      const subscription = await apiClient.put<{ id: number; useProxy: boolean }>(`/subscriptions/${id}`, { useProxy })
      return {
        id: toID(subscription.id),
        useProxy: subscription.useProxy,
      }
    },
    onSuccess: () => {
      void invalidateSubscriptionResource(queryClient)
    },
  })
}
