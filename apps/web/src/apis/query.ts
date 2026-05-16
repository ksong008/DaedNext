import type { APIClientInterface } from './client'
import type {
  ConfigGlobal,
  ConfigListView,
  CurrentUserView,
  DNSListView,
  DNSView,
  GeneralStateView,
  GroupListView,
  GroupResource,
  InterfaceResource,
  LogEntry,
  LogSettings,
  NodeCollection,
  NodeLatencyProbeResult,
  NodeListView,
  NodeResource,
  RoutingListView,
  RoutingView,
  SubscriptionListView,
  SubscriptionResource,
  TrafficOverviewQueryData,
} from './types'
import { useStore } from '@nanostores/react'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  QUERY_KEY_CONFIG,
  QUERY_KEY_DNS,
  QUERY_KEY_GENERAL,
  QUERY_KEY_GROUP,
  QUERY_KEY_LOG,
  QUERY_KEY_NODE,
  QUERY_KEY_NODE_LATENCY,
  QUERY_KEY_ROUTING,
  QUERY_KEY_STORAGE,
  QUERY_KEY_SUBSCRIPTION,
  QUERY_KEY_TRAFFIC,
  QUERY_KEY_USER,
} from '~/constants'
import { useAPIClient } from '~/contexts'

import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'
import { buildAPIURL, normalizeEndpointURL } from './client'
import { resolveNodeTransport } from './node_transport'
import { adaptRuntimeOverview, mergeRuntimeOverviewDelta } from './runtime_overview'

interface JSONStorageResponse {
  values: string[]
}

interface GeneralStateAPI {
  running: boolean
  modified: boolean
  version: string
}

interface InterfaceAPI {
  name: string
  index: number
  up: boolean
  addresses: string[]
  defaultRoutes?: Array<{
    ipVersion?: string
    gateway?: string | null
    source?: string | null
  }>
}

interface RuntimeOverviewAPI {
  updatedAt: string
  uploadRate: string
  downloadRate: string
  uploadTotal: string
  downloadTotal: string
  activeConnections: number
  udpSessions: number
  rssBytes?: string
  heapAllocBytes?: string
  goroutines?: number
  samples: Array<{
    timestamp: string
    uploadRate: string
    downloadRate: string
  }>
}

interface NodeAPI {
  id: number
  link: string
  name: string
  address: string
  protocol: string
  transport?: string | null
  tag?: string | null
  subscriptionId?: number | null
}

interface NodeListAPI {
  items: NodeAPI[]
  totalCount: number
  nextAfterId?: number | null
}

interface NodeLatencyAPI {
  id: number
  latencyMs?: number | null
  alive: boolean
  testedAt: string
  message?: string | null
}

interface ConfigAPI {
  id: number
  name: string
  global: string
  selected: boolean
  parsedGlobal?: ConfigGlobal
  parseError?: string | null
}

interface RoutingAPI {
  id: number
  name: string
  selected: boolean
  parsedRouting?: RoutingView
}

interface DNSAPI {
  id: number
  name: string
  selected: boolean
  parsedDns?: DNSView
}

interface GroupAPI {
  id: number
  name: string
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

interface SubscriptionAPI {
  id: number
  tag?: string | null
  status: string
  link: string
  info: string
  updatedAt: string
  cronExp: string
  cronEnable: boolean
  nodeCount: number
}

function normalizeConfigGlobal(global?: Partial<ConfigGlobal> | null): ConfigGlobal {
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

function trafficOverviewQueryKey(windowSec: number, maxPoints: number) {
  return [...QUERY_KEY_TRAFFIC, windowSec, maxPoints]
}

function buildRuntimeEventsURL(endpointURL: string, token: string, windowSec: number, maxPoints: number) {
  return buildAPIURL(normalizeEndpointURL(endpointURL), '/events/runtime', {
    windowSec,
    maxPoints,
    access_token: token,
  }).toString()
}

export function buildLogEventsURL(endpointURL: string, token: string, level: string, query: string) {
  return buildAPIURL(normalizeEndpointURL(endpointURL), '/events/logs', {
    level,
    q: query,
    access_token: token,
  }).toString()
}

export function getModeRequest(apiClient: APIClientInterface) {
  return async () => {
    const { values } = await apiClient.get<JSONStorageResponse>('/user/me/storage', { path: ['mode'] })
    return values[0]
  }
}

export function getDefaultsRequest(apiClient: APIClientInterface) {
  return async () => {
    const { values } = await apiClient.get<JSONStorageResponse>('/user/me/storage', {
      path: ['defaultConfigID', 'defaultRoutingID', 'defaultDNSID', 'defaultGroupID'],
    })
    const [defaultConfigID, defaultRoutingID, defaultDNSID, defaultGroupID] = values
    return {
      defaultConfigID,
      defaultRoutingID,
      defaultDNSID,
      defaultGroupID,
    }
  }
}

export function getInterfacesRequest(apiClient: APIClientInterface) {
  return async (): Promise<GeneralStateView> => {
    const data = await apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true })
    return {
      general: {
        dae: { running: false, modified: false, version: '' },
        interfaces: data.items.map(adaptInterface),
      },
    }
  }
}

export function useDefaultsQuery() {
  const apiClient = useAPIClient()

  const { data } = useQuery({
    queryKey: QUERY_KEY_STORAGE,
    queryFn: () => getDefaultsRequest(apiClient)(),
  })

  if (!data) {
    return
  }

  return data
}

export function useGeneralQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_GENERAL,
    queryFn: async (): Promise<GeneralStateView> => {
      const [state, interfaces] = await Promise.all([
        apiClient.get<GeneralStateAPI>('/general/state'),
        apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true }),
      ])
      return {
        general: {
          dae: state,
          interfaces: interfaces.items.map(adaptInterface),
        },
      }
    },
  })
}

function trafficOverviewRefetchInterval(windowSec: number) {
  if (windowSec <= 60) return 1_000
  if (windowSec <= 10 * 60) return 2_000
  if (windowSec <= 30 * 60) return 5_000
  return 10_000
}

export function useTrafficOverviewQuery(windowSec: number, maxPoints: number) {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)
  const [isStreamLive, setIsStreamLive] = useState(false)
  const streamEnabled = !isMockMode() && !!token && typeof EventSource !== 'undefined'
  const queryKey = useMemo(() => trafficOverviewQueryKey(windowSec, maxPoints), [windowSec, maxPoints])
  const streamURL = useMemo(
    () => (streamEnabled ? buildRuntimeEventsURL(endpointURL, token, windowSec, maxPoints) : null),
    [endpointURL, maxPoints, streamEnabled, token, windowSec],
  )

  useEffect(() => {
    if (!streamURL) {
      setIsStreamLive(false)
      return
    }

    setIsStreamLive(false)

    const eventSource = new EventSource(streamURL)
    const handleOverview = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as RuntimeOverviewAPI
        queryClient.setQueryData(queryKey, adaptRuntimeOverview(payload))
        setIsStreamLive(true)
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleOverviewDelta = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as RuntimeOverviewAPI
        queryClient.setQueryData<TrafficOverviewQueryData>(queryKey, (previousData) =>
          mergeRuntimeOverviewDelta(previousData, payload, windowSec, maxPoints),
        )
        setIsStreamLive(true)
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleStreamError = () => {
      setIsStreamLive(false)
    }

    eventSource.addEventListener('runtime.overview', handleOverview as EventListener)
    eventSource.addEventListener('runtime.overview.delta', handleOverviewDelta as EventListener)
    eventSource.addEventListener('runtime.error', handleStreamError)
    eventSource.onerror = handleStreamError

    return () => {
      eventSource.removeEventListener('runtime.overview', handleOverview as EventListener)
      eventSource.removeEventListener('runtime.overview.delta', handleOverviewDelta as EventListener)
      eventSource.removeEventListener('runtime.error', handleStreamError)
      eventSource.close()
    }
  }, [maxPoints, queryClient, queryKey, streamURL, windowSec])

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrafficOverviewQueryData> => {
      const data = await apiClient.get<RuntimeOverviewAPI>('/runtime/overview', { windowSec, maxPoints })
      return adaptRuntimeOverview(data)
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: () => (isStreamLive ? false : trafficOverviewRefetchInterval(windowSec)),
    refetchIntervalInBackground: false,
  })
}

export function useNodeLatenciesQuery(refetchIntervalMs: number, enabled = true) {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_NODE_LATENCY,
    queryFn: async (): Promise<NodeLatencyProbeResult[]> => {
      const data = await apiClient.get<{ items: NodeLatencyAPI[] }>('/nodes/latencies')
      return data.items.map((item) => ({
        id: String(item.id),
        latencyMs: item.latencyMs ?? null,
        alive: item.alive,
        testedAt: item.testedAt,
        message: item.message ?? null,
      }))
    },
    enabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: () => refetchIntervalMs,
    refetchIntervalInBackground: false,
  })
}

export function useLogsQuery({ level, query, limit = 500 }: { level: string; query: string; limit?: number }) {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: [...QUERY_KEY_LOG, 'items', level, query, limit],
    queryFn: async (): Promise<{ items: LogEntry[] }> => {
      return apiClient.get<{ items: LogEntry[] }>('/logs', { level, q: query, limit })
    },
    placeholderData: (previousData) => previousData,
  })
}

export function useLogSettingsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: [...QUERY_KEY_LOG, 'settings'],
    queryFn: async (): Promise<LogSettings> => {
      return apiClient.get<LogSettings>('/logs/settings')
    },
  })
}

export function useRuntimeLogLevelQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: [...QUERY_KEY_LOG, 'runtime-level'],
    queryFn: async (): Promise<{ level: string }> => {
      return apiClient.get<{ level: string }>('/runtime/log-level')
    },
  })
}

export function useNodesQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_NODE,
    queryFn: async (): Promise<NodeListView> => {
      const data = await apiClient.get<NodeListAPI>('/nodes')
      return {
        nodes: adaptNodesConnection(data),
      }
    },
  })
}

export function useSubscriptionsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_SUBSCRIPTION,
    queryFn: async (): Promise<SubscriptionListView> => {
      const data = await apiClient.get<{ items: Array<SubscriptionAPI & { nodes?: NodeListAPI }> }>('/subscriptions', {
        expand: 'nodes',
      })
      const subscriptions = await Promise.all(
        data.items.map(async (subscription): Promise<SubscriptionResource> => {
          const nodes =
            subscription.nodes ?? (await apiClient.get<NodeListAPI>(`/subscriptions/${subscription.id}/nodes`))
          return {
            id: String(subscription.id),
            tag: subscription.tag ?? null,
            status: subscription.status,
            link: subscription.link,
            info: subscription.info,
            updatedAt: subscription.updatedAt,
            cronExp: subscription.cronExp,
            cronEnable: subscription.cronEnable,
            nodes: adaptNodesConnection(nodes),
          }
        }),
      )
      return { subscriptions }
    },
  })
}

export function useConfigsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_CONFIG,
    queryFn: async (): Promise<ConfigListView> => {
      const data = await apiClient.get<{ items: ConfigAPI[] }>('/configs', { expand: 'parsed' })
      return {
        configs: data.items.map((config) => ({
          id: String(config.id),
          name: config.name,
          selected: config.selected,
          rawGlobal: config.global ?? '',
          parseError: config.parseError ?? null,
          global: normalizeConfigGlobal(config.parsedGlobal),
        })),
      }
    },
  })
}

export function useGroupsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_GROUP,
    queryFn: async (): Promise<GroupListView> => {
      const data = await apiClient.get<{ items: GroupAPI[] }>('/groups')
      return {
        groups: data.items.map((group) => ({
          id: String(group.id),
          name: group.name,
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
          policyParams: group.policyParams.map((param) => ({
            key: param.key ?? null,
            val: param.val,
          })),
        })),
      }
    },
  })
}

export function useRoutingsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_ROUTING,
    queryFn: async (): Promise<RoutingListView> => {
      const data = await apiClient.get<{ items: RoutingAPI[] }>('/routings', { expand: 'parsed' })
      return {
        routings: data.items.map((routing) => ({
          id: String(routing.id),
          name: routing.name,
          selected: routing.selected,
          routing: routing.parsedRouting || { string: '' },
        })),
      }
    },
  })
}

export function useDNSsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_DNS,
    queryFn: async (): Promise<DNSListView> => {
      const data = await apiClient.get<{ items: DNSAPI[] }>('/dns', { expand: 'parsed' })
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
  })
}

export function useUserQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_USER,
    queryFn: async (): Promise<CurrentUserView> => {
      const user = await apiClient.get<CurrentUserView['user']>('/user/me')
      return { user }
    },
  })
}

function adaptNodesConnection(data: NodeListAPI): NodeCollection {
  const items = data.items.map(adaptNode)
  return {
    totalCount: data.totalCount,
    items,
  }
}

function adaptNode(node: NodeAPI): NodeResource {
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

function adaptInterface(iface: InterfaceAPI): InterfaceResource {
  return {
    name: iface.name,
    index: iface.index,
    up: iface.up,
    addresses: Array.isArray(iface.addresses) ? iface.addresses : [],
    defaultRoutes: Array.isArray(iface.defaultRoutes) ? iface.defaultRoutes : [],
  }
}
