import type { QueryClient } from '@tanstack/react-query'
import type {
  ConfigGlobal,
  ConfigListView,
  ConfigPreviewResult,
  ConfigResource,
  ConfigSummaryListView,
  DNSListView,
  DNSSummaryListView,
  DNSView,
  GlobalInput,
  RoutingListView,
  RoutingSummaryListView,
  RoutingView,
} from '../types'
import type { ResourceWithID } from './shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { toID } from '../client'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { useAuthenticatedQueryEnabled } from './shared'

export interface ConfigAPI {
  id: number
  name: string
  global: string
  selected: boolean
  parsedGlobal?: ConfigGlobal
  parseError?: string | null
}

export interface RoutingAPI {
  id: number
  name: string
  selected: boolean
  parsedRouting?: RoutingView
}

export interface DNSAPI {
  id: number
  name: string
  selected: boolean
  parsedDns?: DNSView
}

export interface SectionSummaryAPI {
  id: number
  name: string
  selected: boolean
  version: number
  parseStatus?: string | null
  parseError?: string | null
}

export function normalizeConfigGlobal(global?: Partial<ConfigGlobal> | null): ConfigGlobal {
  return {
    logLevel: global?.logLevel ?? '',
    tproxyPort: global?.tproxyPort ?? 0,
    allowInsecure: global?.allowInsecure ?? false,
    checkInterval: global?.checkInterval ?? '',
    checkTolerance: global?.checkTolerance ?? '',
    lanInterface: global?.lanInterface ?? [],
    wanInterface: global?.wanInterface ?? [],
    udpCheckDns: global?.udpCheckDns ?? [],
    tcpCheckUrl: global?.tcpCheckUrl ?? [],
    fallbackResolver: global?.fallbackResolver ?? '',
    dialMode: global?.dialMode ?? '',
    tcpCheckHttpMethod: global?.tcpCheckHttpMethod ?? '',
    disableWaitingNetwork: global?.disableWaitingNetwork ?? false,
    autoConfigKernelParameter: global?.autoConfigKernelParameter ?? false,
    sniffingTimeout: global?.sniffingTimeout ?? '',
    tlsImplementation: global?.tlsImplementation ?? '',
    utlsImitate: global?.utlsImitate ?? '',
    tproxyPortProtect: global?.tproxyPortProtect ?? false,
    soMarkFromDae: global?.soMarkFromDae ?? 0,
    pprofPort: global?.pprofPort ?? 0,
    enableLocalTcpFastRedirect: global?.enableLocalTcpFastRedirect ?? false,
    mptcp: global?.mptcp ?? false,
    bandwidthMaxTx: global?.bandwidthMaxTx ?? '',
    bandwidthMaxRx: global?.bandwidthMaxRx ?? '',
  }
}

export function useConfigSummariesQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.config.summary(),
    queryFn: async ({ signal }): Promise<ConfigSummaryListView> => {
      const data = await apiClient.get<{ items: SectionSummaryAPI[] }>('/configs', { summary: true }, { signal })
      return {
        configs: data.items.map(adaptSectionSummary),
      }
    },
    enabled,
  })
}

export function useConfigQuery(id?: string | null, enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled && !!id)

  return useQuery({
    queryKey: webQueryKeys.config.item(id),
    queryFn: async ({ signal }): Promise<ConfigResource> => {
      const config = await apiClient.get<ConfigAPI>(`/configs/${id}`, undefined, { signal })
      return adaptConfig(config)
    },
    enabled: queryEnabled,
  })
}

export function useConfigsQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.config.expanded(),
    queryFn: async ({ signal }): Promise<ConfigListView> => {
      const data = await apiClient.get<{ items: ConfigAPI[] }>('/configs', { expand: 'parsed' }, { signal })
      return {
        configs: data.items.map(adaptConfig),
      }
    },
    enabled: queryEnabled,
  })
}

export function useRoutingSummariesQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.routing.summary(),
    queryFn: async ({ signal }): Promise<RoutingSummaryListView> => {
      const data = await apiClient.get<{ items: SectionSummaryAPI[] }>('/routings', { summary: true }, { signal })
      return {
        routings: data.items.map(adaptSectionSummary),
      }
    },
    enabled,
  })
}

export function useRoutingsQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.routing.expanded(),
    queryFn: async ({ signal }): Promise<RoutingListView> => {
      const data = await apiClient.get<{ items: RoutingAPI[] }>('/routings', { expand: 'parsed' }, { signal })
      return {
        routings: data.items.map((routing) => ({
          id: String(routing.id),
          name: routing.name,
          selected: routing.selected,
          routing: routing.parsedRouting || { string: '' },
        })),
      }
    },
    enabled: queryEnabled,
  })
}

export function useDNSSummariesQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.dns.summary(),
    queryFn: async ({ signal }): Promise<DNSSummaryListView> => {
      const data = await apiClient.get<{ items: SectionSummaryAPI[] }>('/dns', { summary: true }, { signal })
      return {
        dnss: data.items.map(adaptSectionSummary),
      }
    },
    enabled,
  })
}

export function useDNSsQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.dns.expanded(),
    queryFn: async ({ signal }): Promise<DNSListView> => {
      const data = await apiClient.get<{ items: DNSAPI[] }>('/dns', { expand: 'parsed' }, { signal })
      return {
        dnss: data.items.map((dns) => ({
          id: String(dns.id),
          name: dns.name,
          selected: dns.selected,
          dns: dns.parsedDns || {
            string: '',
            routing: {
              request: { string: '' },
              response: { string: '' },
            },
          },
        })),
      }
    },
    enabled: queryEnabled,
  })
}

export function adaptSectionSummary(section: SectionSummaryAPI) {
  return {
    id: String(section.id),
    name: section.name,
    selected: section.selected,
    version: section.version,
    parseStatus: section.parseStatus ?? null,
    parseError: section.parseError ?? null,
  }
}

export function adaptConfig(config: ConfigAPI): ConfigResource {
  return {
    id: String(config.id),
    name: config.name,
    selected: config.selected,
    rawGlobal: config.global ?? '',
    parseError: config.parseError ?? null,
    global: normalizeConfigGlobal(config.parsedGlobal),
  }
}

export function invalidateConfigResource(
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

export function invalidateRoutingResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.routing.summary(),
    webQueryKeys.routing.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
}

export function invalidateDNSResource(queryClient: QueryClient, { generalState = false } = {}) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.dns.summary(),
    webQueryKeys.dns.expanded(),
    ...(generalState ? [webQueryKeys.general.state()] : []),
  ])
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
