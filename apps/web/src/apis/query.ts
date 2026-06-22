import type { APIClientInterface } from './client'
import type {
  ConfigGlobal,
  ConfigListView,
  ConfigResource,
  ConfigSummaryListView,
  CurrentUserView,
  DNSListView,
  DNSSummaryListView,
  DNSView,
  GeneralDaemonState,
  GeneralResourceCounts,
  GeneralStateView,
  GroupListView,
  GroupResource,
  GroupSummaryListView,
  GroupSummaryResource,
  InterfaceResource,
  LogEntry,
  LogSettings,
  NodeCollection,
  NodeLatencyJob,
  NodeLatencyJobView,
  NodeLatencyProbeResult,
  NodeListView,
  NodeResource,
  RoutingListView,
  RoutingSummaryListView,
  RoutingView,
  RuntimeOverviewRuntimeState,
  SubscriptionListView,
  SubscriptionResource,
  SubscriptionSummaryListView,
  SubscriptionSummaryResource,
  TrafficOverviewQueryData,
} from './types'
import { useStore } from '@nanostores/react'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useAPIClient } from '~/contexts'

import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'
import { buildEventStreamURL, subscribeEventStream } from './event_stream'
import { resolveNodeTransport } from './node_transport'
import { webQueryKeys } from './query_cache'
import { adaptRuntimeOverview, mergeRuntimeOverviewDelta } from './runtime_overview'

interface JSONStorageResponse {
  values: string[]
}

function useAuthenticatedQueryEnabled(enabled = true) {
  const token = useStore(tokenAtom)
  return enabled && (isMockMode() || !!token)
}

interface GeneralStateAPI {
  running: boolean
  modified: boolean
  version: string
  netnsLinkMode?: string
  attachBackend?: string
  counts?: Partial<GeneralResourceCounts>
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
  cpuUsagePercent?: number
  rssBytes?: string
  heapLiveBytes?: string | null
  goroutines?: number
  runtime?: RuntimeOverviewRuntimeState
  samples?: Array<{
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

interface NodeLatencyJobAPI {
  id: number
  status: string
  total: number
  completed: number
  succeeded: number
  failed: number
  queuedAt: string
  startedAt?: string | null
  finishedAt?: string | null
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

interface SectionSummaryAPI {
  id: number
  name: string
  selected: boolean
  version: number
  parseStatus?: string | null
  parseError?: string | null
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

interface GroupSummaryAPI {
  id: number
  name: string
  policy: string
  policyParams: Array<{ key?: string | null; val: string }>
  version: number
  nodeCount: number
  subscriptionCount: number
  firstNode?: NodeAPI | null
  firstSubscription?: {
    subscriptionId: number
    nameFilterRegex?: string | null
    matchedCount: number
    sampleMatchedNodes?: NodeAPI[] | null
    updatedAt: string
    status: string
    info: string
    link: string
    tag?: string | null
  } | null
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
  useProxy: boolean
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
  return webQueryKeys.traffic.overview(windowSec, maxPoints)
}

export function buildRuntimeEventsURL(endpointURL: string, windowSec: number, maxPoints: number) {
  return buildEventStreamURL(endpointURL, '/events/runtime', {
    windowSec,
    maxPoints,
  }).toString()
}

export function buildLogEventsURL(endpointURL: string, level: string, query: string) {
  return buildEventStreamURL(endpointURL, '/events/logs', {
    level,
    q: query,
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

function emptyGeneralResourceCounts(): GeneralResourceCounts {
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

function normalizeGeneralResourceCounts(counts?: Partial<GeneralResourceCounts>): GeneralResourceCounts {
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

function adaptGeneralDaemonState(state: GeneralStateAPI): GeneralDaemonState {
  return {
    running: state.running,
    modified: state.modified,
    version: state.version,
    netnsLinkMode: state.netnsLinkMode,
    attachBackend: state.attachBackend,
  }
}

function adaptGeneralStateView(state: GeneralStateAPI, interfaces: InterfaceResource[] = []): GeneralStateView {
  return {
    general: {
      dae: adaptGeneralDaemonState(state),
      counts: normalizeGeneralResourceCounts(state.counts),
      interfaces,
    },
  }
}

export function getInterfacesRequest(apiClient: APIClientInterface) {
  return async (): Promise<GeneralStateView> => {
    const data = await apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true })
    return {
      general: {
        dae: { running: false, modified: false, version: '', netnsLinkMode: '', attachBackend: '' },
        counts: emptyGeneralResourceCounts(),
        interfaces: data.items.map(adaptInterface),
      },
    }
  }
}

export function useDefaultsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  const { data } = useQuery({
    queryKey: webQueryKeys.storage(),
    queryFn: () => getDefaultsRequest(apiClient)(),
    enabled,
  })

  if (!data) {
    return
  }

  return data
}

export function useGeneralQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.general.root(),
    queryFn: async (): Promise<GeneralStateView> => {
      const [state, interfaces] = await Promise.all([
        apiClient.get<GeneralStateAPI>('/general/state'),
        apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true }),
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
    queryFn: async (): Promise<GeneralStateView> => {
      const state = await apiClient.get<GeneralStateAPI>('/general/state')
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
    queryFn: async (): Promise<InterfaceResource[]> => {
      const data = await apiClient.get<{ items: InterfaceAPI[] }>('/general/interfaces', { up: true })
      return data.items.map(adaptInterface)
    },
    enabled,
  })
}

function trafficOverviewRefetchInterval() {
  return 1_000
}

export function useTrafficOverviewQuery(windowSec: number, maxPoints: number) {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)
  const [isStreamLive, setIsStreamLive] = useState(false)
  const queryEnabled = isMockMode() || !!token
  const streamEnabled = !isMockMode() && !!token && typeof fetch !== 'undefined'
  const queryKey = useMemo(() => trafficOverviewQueryKey(windowSec, maxPoints), [windowSec, maxPoints])
  const streamURL = useMemo(
    () => (streamEnabled ? buildRuntimeEventsURL(endpointURL, windowSec, maxPoints) : null),
    [endpointURL, maxPoints, streamEnabled, windowSec],
  )

  useEffect(() => {
    if (!streamURL) {
      setIsStreamLive(false)
      return
    }

    setIsStreamLive(false)

    const handleOverview = (data: string) => {
      try {
        const payload = JSON.parse(data) as RuntimeOverviewAPI
        queryClient.setQueryData(queryKey, adaptRuntimeOverview(payload))
        setIsStreamLive(true)
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleOverviewDelta = (data: string) => {
      try {
        const payload = JSON.parse(data) as RuntimeOverviewAPI
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

    const unsubscribe = subscribeEventStream({
      url: streamURL,
      token,
      onMessage(message) {
        if (message.event === 'runtime.overview') {
          handleOverview(message.data)
        } else if (message.event === 'runtime.overview.delta') {
          handleOverviewDelta(message.data)
        } else if (message.event === 'runtime.error') {
          handleStreamError()
        }
      },
      onError: handleStreamError,
    })

    return () => {
      unsubscribe()
    }
  }, [maxPoints, queryClient, queryKey, streamURL, token, windowSec])

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TrafficOverviewQueryData> => {
      const data = await apiClient.get<RuntimeOverviewAPI>('/runtime/overview', { windowSec, maxPoints })
      return adaptRuntimeOverview(data)
    },
    enabled: queryEnabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: () => (isStreamLive ? false : trafficOverviewRefetchInterval()),
    refetchIntervalInBackground: false,
  })
}

export function adaptNodeLatencyProbeResults(items: NodeLatencyAPI[]): NodeLatencyProbeResult[] {
  return items.map((item) => ({
    id: String(item.id),
    latencyMs: item.latencyMs ?? null,
    alive: item.alive,
    testedAt: item.testedAt,
    message: item.message ?? null,
  }))
}

export function adaptNodeLatencyJob(job?: NodeLatencyJobAPI | null): NodeLatencyJob | null {
  if (!job) return null
  return {
    id: String(job.id),
    status: job.status,
    total: job.total,
    completed: job.completed,
    succeeded: job.succeeded,
    failed: job.failed,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    message: job.message ?? null,
  }
}

export function useNodeLatenciesQuery(refetchIntervalMs: number, enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.latency(),
    queryFn: async (): Promise<NodeLatencyProbeResult[]> => {
      const data = await apiClient.get<{ items: NodeLatencyAPI[] }>('/nodes/latencies')
      return adaptNodeLatencyProbeResults(data.items)
    },
    enabled: queryEnabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: () => refetchIntervalMs,
    refetchIntervalInBackground: false,
  })
}

export function useNodeLatencyJobQuery(refetchIntervalMs: number, enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.latencyJob(),
    queryFn: async (): Promise<NodeLatencyJobView> => {
      const data = await apiClient.get<{ job?: NodeLatencyJobAPI | null }>('/nodes/latencies/job')
      return { job: adaptNodeLatencyJob(data.job) }
    },
    enabled: queryEnabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: () => refetchIntervalMs,
    refetchIntervalInBackground: false,
  })
}

export function useLogsQuery({ level, query, limit = 500 }: { level: string; query: string; limit?: number }) {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: [...webQueryKeys.log.items(), level, query, limit],
    queryFn: async (): Promise<{ items: LogEntry[] }> => {
      return apiClient.get<{ items: LogEntry[] }>('/logs', { level, q: query, limit })
    },
    enabled,
  })
}

export function useLogSettingsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.log.settings(),
    queryFn: async (): Promise<LogSettings> => {
      return apiClient.get<LogSettings>('/logs/settings')
    },
    enabled,
  })
}

export function useRuntimeLogLevelQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.log.runtimeLevel(),
    queryFn: async (): Promise<{ level: string }> => {
      return apiClient.get<{ level: string }>('/runtime/log-level')
    },
    enabled,
  })
}

export function useNodesQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.list(),
    queryFn: async (): Promise<NodeListView> => {
      const data = await apiClient.get<NodeListAPI>('/nodes')
      return {
        nodes: adaptNodesConnection(data),
      }
    },
    enabled: queryEnabled,
  })
}

export function useSubscriptionBackedNodesQuery(enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.subscriptionBackedList(),
    queryFn: async (): Promise<NodeListView> => {
      const data = await apiClient.get<NodeListAPI>('/nodes', { independent: false })
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
    queryFn: async (): Promise<SubscriptionSummaryListView> => {
      const data = await apiClient.get<{ items: SubscriptionAPI[] }>('/subscriptions')
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

export function useConfigSummariesQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.config.summary(),
    queryFn: async (): Promise<ConfigSummaryListView> => {
      const data = await apiClient.get<{ items: SectionSummaryAPI[] }>('/configs', { summary: true })
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
    queryFn: async (): Promise<ConfigResource> => {
      const config = await apiClient.get<ConfigAPI>(`/configs/${id}`)
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
    queryFn: async (): Promise<ConfigListView> => {
      const data = await apiClient.get<{ items: ConfigAPI[] }>('/configs', { expand: 'parsed' })
      return {
        configs: data.items.map(adaptConfig),
      }
    },
    enabled: queryEnabled,
  })
}

export function useGroupsSummaryQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.group.summary(),
    queryFn: async (): Promise<GroupSummaryListView> => {
      const data = await apiClient.get<{ items: GroupSummaryAPI[] }>('/groups', { summary: true })
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
    queryFn: async (): Promise<GroupListView> => {
      const data = await apiClient.get<{ items: GroupAPI[] }>('/groups')
      return {
        groups: data.items.map(adaptGroup),
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
    queryFn: async (): Promise<RoutingSummaryListView> => {
      const data = await apiClient.get<{ items: SectionSummaryAPI[] }>('/routings', { summary: true })
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
    enabled: queryEnabled,
  })
}

export function useDNSSummariesQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.dns.summary(),
    queryFn: async (): Promise<DNSSummaryListView> => {
      const data = await apiClient.get<{ items: SectionSummaryAPI[] }>('/dns', { summary: true })
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
    enabled: queryEnabled,
  })
}

export function useUserQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.user(),
    queryFn: async (): Promise<CurrentUserView> => {
      const user = await apiClient.get<CurrentUserView['user']>('/user/me')
      return { user }
    },
    enabled,
  })
}

function adaptNodesConnection(data: NodeListAPI): NodeCollection {
  const items = data.items.map(adaptNode)
  return {
    totalCount: data.totalCount,
    items,
  }
}

function adaptSectionSummary(section: SectionSummaryAPI) {
  return {
    id: String(section.id),
    name: section.name,
    selected: section.selected,
    version: section.version,
    parseStatus: section.parseStatus ?? null,
    parseError: section.parseError ?? null,
  }
}

function adaptConfig(config: ConfigAPI): ConfigResource {
  return {
    id: String(config.id),
    name: config.name,
    selected: config.selected,
    rawGlobal: config.global ?? '',
    parseError: config.parseError ?? null,
    global: normalizeConfigGlobal(config.parsedGlobal),
  }
}

function adaptSubscriptionSummary(subscription: SubscriptionAPI): SubscriptionSummaryResource {
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

function adaptGroup(group: GroupAPI): GroupResource {
  return {
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
    policyParams: group.policyParams.map(adaptPolicyParam),
  }
}

function adaptGroupSummary(group: GroupSummaryAPI): GroupSummaryResource {
  const firstSubscription = group.firstSubscription
  return {
    id: String(group.id),
    name: group.name,
    policy: group.policy as GroupSummaryResource['policy'],
    policyParams: group.policyParams.map(adaptPolicyParam),
    version: group.version,
    nodeCount: group.nodeCount,
    subscriptionCount: group.subscriptionCount,
    firstNode: group.firstNode ? adaptNode(group.firstNode) : null,
    firstSubscription: firstSubscription
      ? {
          nameFilterRegex: firstSubscription.nameFilterRegex ?? null,
          matchedCount: firstSubscription.matchedCount,
          subscription: {
            id: String(firstSubscription.subscriptionId),
            updatedAt: firstSubscription.updatedAt,
            tag: firstSubscription.tag ?? null,
            status: firstSubscription.status,
            link: firstSubscription.link,
            info: firstSubscription.info,
          },
          sampleMatchedNodes: (firstSubscription.sampleMatchedNodes ?? []).map(adaptNode),
        }
      : null,
  }
}

function adaptPolicyParam(param: { key?: string | null; val: string }) {
  return {
    key: param.key ?? null,
    val: param.val,
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
