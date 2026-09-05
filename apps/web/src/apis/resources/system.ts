import type { APIClientInterface } from '../client'
import type {
  GeneralDaemonState,
  GeneralResourceCounts,
  GeneralStateView,
  InterfaceAddressDetail,
  InterfaceResource,
  RuntimeOverviewRuntimeState,
  RuntimeRevisionReport,
} from '../types'
import { useQuery } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { webQueryKeys } from '../query_cache'
import { useAuthenticatedQueryEnabled } from './shared'

export interface GeneralStateAPI {
  running: boolean
  modified: boolean
  version: string
  netnsLinkMode?: string
  attachBackend?: string
  runtime?: RuntimeOverviewRuntimeState
  runtimeRevision?: RuntimeRevisionReport
  counts?: Partial<GeneralResourceCounts>
}

export interface InterfaceAPI {
  name: string
  index: number
  up: boolean
  addresses: string[]
  addressDetails?: InterfaceAddressDetailAPI[]
  defaultRoutes?: Array<{
    ipVersion?: string
    gateway?: string | null
    source?: string | null
  }>
}

export interface InterfaceAddressDetailAPI {
  family?: string
  local?: string
  prefixlen?: number
  scope?: string | null
}

export function emptyGeneralResourceCounts(): GeneralResourceCounts {
  return {
    configs: 0,
    dns: 0,
    routings: 0,
    groups: 0,
    nodes: 0,
    subscriptions: 0,
    logs: 0,
  }
}

export function normalizeGeneralResourceCounts(counts?: Partial<GeneralResourceCounts>): GeneralResourceCounts {
  const emptyCounts = emptyGeneralResourceCounts()
  return {
    configs: counts?.configs ?? emptyCounts.configs,
    dns: counts?.dns ?? emptyCounts.dns,
    routings: counts?.routings ?? emptyCounts.routings,
    groups: counts?.groups ?? emptyCounts.groups,
    nodes: counts?.nodes ?? emptyCounts.nodes,
    subscriptions: counts?.subscriptions ?? emptyCounts.subscriptions,
    logs: counts?.logs ?? emptyCounts.logs,
  }
}

export function adaptGeneralDaemonState(state: GeneralStateAPI): GeneralDaemonState {
  return {
    running: state.running,
    modified: state.modified,
    version: state.version,
    netnsLinkMode: state.netnsLinkMode,
    attachBackend: state.attachBackend,
    runtime: state.runtime,
    runtimeRevision: state.runtimeRevision,
  }
}

export function adaptGeneralStateView(state: GeneralStateAPI, interfaces: InterfaceResource[] = []): GeneralStateView {
  return {
    general: {
      dae: adaptGeneralDaemonState(state),
      counts: normalizeGeneralResourceCounts(state.counts),
      interfaces,
    },
  }
}

export function getInterfacesRequest(apiClient: APIClientInterface) {
  return async (signal?: AbortSignal): Promise<GeneralStateView> => {
    const data = await apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true }, { signal })
    return {
      general: {
        dae: { running: false, modified: false, version: '', netnsLinkMode: '', attachBackend: '' },
        counts: emptyGeneralResourceCounts(),
        interfaces: data.items.map(adaptInterface),
      },
    }
  }
}

export function useGeneralQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.general.root(),
    queryFn: async ({ signal }): Promise<GeneralStateView> => {
      const [state, interfaces] = await Promise.all([
        apiClient.get<GeneralStateAPI>('/general/state', undefined, { signal }),
        apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true }, { signal }),
      ])
      return adaptGeneralStateView(state, interfaces.items.map(adaptInterface))
    },
    enabled,
  })
}

export function useGeneralStateQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.general.state(),
    queryFn: async ({ signal }): Promise<GeneralStateView> => {
      const state = await apiClient.get<GeneralStateAPI>('/general/state', undefined, { signal })
      return adaptGeneralStateView(state)
    },
    enabled,
  })
}

export function useInterfacesQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.general.interfaces(),
    queryFn: async ({ signal }): Promise<InterfaceResource[]> => {
      const data = await apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true }, { signal })
      return data.items.map(adaptInterface)
    },
    enabled,
  })
}

export function adaptInterface(iface: InterfaceAPI): InterfaceResource {
  return {
    name: iface.name,
    index: iface.index,
    up: iface.up,
    addresses: Array.isArray(iface.addresses) ? iface.addresses : [],
    addressDetails: Array.isArray(iface.addressDetails)
      ? iface.addressDetails
          .map(adaptInterfaceAddressDetail)
          .filter((detail): detail is InterfaceAddressDetail => detail !== null)
      : [],
    defaultRoutes: Array.isArray(iface.defaultRoutes) ? iface.defaultRoutes : [],
  }
}

export function adaptInterfaceAddressDetail(detail: InterfaceAddressDetailAPI): InterfaceAddressDetail | null {
  if (typeof detail.local !== 'string' || detail.local.trim().length === 0) {
    return null
  }
  return {
    family: typeof detail.family === 'string' && detail.family.length > 0 ? detail.family : undefined,
    local: detail.local,
    prefixlen: Number.isFinite(detail.prefixlen) ? detail.prefixlen : undefined,
    scope: typeof detail.scope === 'string' ? detail.scope : undefined,
  }
}
