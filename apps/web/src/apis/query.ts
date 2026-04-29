import { parseNodeUrl } from '@daeuniverse/dae-node-parser'
import { useQuery } from '@tanstack/react-query'

import {
  QUERY_KEY_CONFIG,
  QUERY_KEY_DNS,
  QUERY_KEY_GENERAL,
  QUERY_KEY_GROUP,
  QUERY_KEY_NODE,
  QUERY_KEY_NODE_LATENCY,
  QUERY_KEY_ROUTING,
  QUERY_KEY_STORAGE,
  QUERY_KEY_SUBSCRIPTION,
  QUERY_KEY_TRAFFIC,
  QUERY_KEY_USER,
} from '~/constants'
import { useAPIClient } from '~/contexts'

import type { APIClientInterface } from './client'
import type {
  ConfigGlobal,
  ConfigsQuery,
  DNSsQuery,
  DNSView,
  GeneralQuery,
  GroupResource,
  GroupsQuery,
  InterfaceResource,
  NodeLatencyProbeResult,
  NodeResource,
  NodesConnection,
  NodesQuery,
  RoutingsQuery,
  RoutingView,
  SubscriptionResource,
  SubscriptionsQuery,
  TrafficOverviewQueryData,
  UserQuery,
} from './types'

type JSONStorageResponse = {
  values: string[]
}

type GeneralStateAPI = {
  running: boolean
  modified: boolean
  version: string
}

type InterfaceAPI = {
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

type RuntimeOverviewAPI = {
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

type NodeAPI = {
  id: number
  link: string
  name: string
  address: string
  protocol: string
  transport?: string | null
  tag?: string | null
  subscriptionId?: number | null
}

type NodeListAPI = {
  items: NodeAPI[]
  totalCount: number
  nextAfterId?: number | null
}

type NodeLatencyAPI = {
  id: number
  latencyMs?: number | null
  alive: boolean
  testedAt: string
  message?: string | null
}

type ConfigAPI = {
  id: number
  name: string
  selected: boolean
  parsedGlobal?: ConfigGlobal
}

type RoutingAPI = {
  id: number
  name: string
  selected: boolean
  parsedRouting?: RoutingView
}

type DNSAPI = {
  id: number
  name: string
  selected: boolean
  parsedDns?: DNSView
}

type GroupAPI = {
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

type SubscriptionAPI = {
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
  return async (): Promise<GeneralQuery> => {
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
    queryFn: async (): Promise<GeneralQuery> => {
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

  return useQuery({
    queryKey: [...QUERY_KEY_TRAFFIC, windowSec, maxPoints],
    queryFn: async (): Promise<TrafficOverviewQueryData> => {
      const data = await apiClient.get<RuntimeOverviewAPI>('/runtime/overview', { windowSec, maxPoints })
      return {
        updatedAt: data.updatedAt,
        uploadRate: Number(data.uploadRate),
        downloadRate: Number(data.downloadRate),
        uploadTotal: data.uploadTotal,
        downloadTotal: data.downloadTotal,
        activeConnections: data.activeConnections,
        udpSessions: data.udpSessions,
        rssBytes: data.rssBytes || '0',
        heapAllocBytes: data.heapAllocBytes || '0',
        goroutines: data.goroutines ?? 0,
        samples: data.samples.map((sample) => ({
          timestamp: sample.timestamp,
          uploadRate: Number(sample.uploadRate),
          downloadRate: Number(sample.downloadRate),
        })),
      }
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: () => trafficOverviewRefetchInterval(windowSec),
    refetchIntervalInBackground: false,
  })
}

export function useNodeLatenciesQuery(refetchIntervalMs: number) {
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
    placeholderData: (previousData) => previousData,
    refetchInterval: () => refetchIntervalMs,
    refetchIntervalInBackground: false,
  })
}

export function useNodesQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_NODE,
    queryFn: async (): Promise<NodesQuery> => {
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
    queryFn: async (): Promise<SubscriptionsQuery> => {
      const data = await apiClient.get<{ items: SubscriptionAPI[] }>('/subscriptions')
      const subscriptions = await Promise.all(
        data.items.map(async (subscription): Promise<SubscriptionResource> => {
          const nodes = await apiClient.get<NodeListAPI>(`/subscriptions/${subscription.id}/nodes`)
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
    queryFn: async (): Promise<ConfigsQuery> => {
      const data = await apiClient.get<{ items: ConfigAPI[] }>('/configs', { expand: 'parsed' })
      return {
        configs: data.items.map((config) => ({
          id: String(config.id),
          name: config.name,
          selected: config.selected,
          global: config.parsedGlobal || ({} as ConfigGlobal),
        })),
      }
    },
  })
}

export function useGroupsQuery() {
  const apiClient = useAPIClient()

  return useQuery({
    queryKey: QUERY_KEY_GROUP,
    queryFn: async (): Promise<GroupsQuery> => {
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
    queryFn: async (): Promise<RoutingsQuery> => {
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
    queryFn: async (): Promise<DNSsQuery> => {
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
    queryFn: async (): Promise<UserQuery> => {
      const user = await apiClient.get<UserQuery['user']>('/user/me')
      return { user }
    },
  })
}

function adaptNodesConnection(data: NodeListAPI): NodesConnection {
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
    transport: node.transport ?? deriveTransport(node.link, node.protocol),
    tag: node.tag ?? null,
    subscriptionID: node.subscriptionId ? String(node.subscriptionId) : null,
  }
}

function adaptInterface(iface: InterfaceAPI): InterfaceResource {
  return {
    name: iface.name,
    index: iface.index,
    up: iface.up,
    addresses: iface.addresses,
    defaultRoutes: iface.defaultRoutes || [],
  }
}

function deriveTransport(link: string, protocol: string): string | null {
  const parsed = parseNodeUrl(link)
  if (parsed?.type === 'v2ray' && parsed.data && typeof parsed.data === 'object' && 'net' in parsed.data) {
    const net = parsed.data.net
    return typeof net === 'string' ? net : null
  }
  if (parsed?.type === 'trojan' && parsed.data && typeof parsed.data === 'object' && 'obfs' in parsed.data) {
    return parsed.data.obfs === 'websocket' ? 'ws' : null
  }
  if (parsed?.type === 'ss' && parsed.data && typeof parsed.data === 'object' && 'plugin' in parsed.data) {
    if (parsed.data.plugin === 'v2ray-plugin' && 'mode' in parsed.data && typeof parsed.data.mode === 'string') {
      return parsed.data.mode
    }
    return typeof parsed.data.plugin === 'string' && parsed.data.plugin ? parsed.data.plugin : null
  }
  if (protocol === 'http' || protocol === 'https' || protocol === 'socks5') {
    return protocol
  }
  return null
}
