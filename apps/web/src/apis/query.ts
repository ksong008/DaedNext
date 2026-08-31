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
  GeodataKind,
  GeodataSettingsView,
  GeodataView,
  GroupListView,
  GroupResource,
  GroupSummaryListView,
  GroupSummaryResource,
  InterfaceAddressDetail,
  InterfaceResource,
  LogEntry,
  LogSettings,
  NodeCollection,
  NodeLatencyProbeResult,
  NodeListView,
  NodeResource,
  RoutingListView,
  RoutingSummaryListView,
  RoutingView,
  RuntimeOverviewRuntimeState,
  RuntimeRevisionReport,
  SubscriptionListView,
  SubscriptionResource,
  SubscriptionSummaryListView,
  SubscriptionSummaryResource,
  TrafficOverviewQueryData,
} from './types'
import { useStore } from '@nanostores/react'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAPIClient } from '~/contexts'
import { isMockMode } from '~/mocks'

import { endpointURLAtom, tokenAtom } from '~/store'
import { normalizeEndpointURL } from './client'
import { buildEventStreamURL, subscribeEventStream } from './event_stream'
import { nodeLatencyJobQueryOptions } from './node_latency_job_query'
import { resolveNodeTransport } from './node_transport'
import { webQueryKeys } from './query_cache'
import { handleRuntimeGroupSelectionEvent } from './runtime_event_cache'
import { adaptRuntimeOverview, mergeRuntimeOverviewDelta, runtimeOverviewIsFresh } from './runtime_overview'

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
  runtime?: RuntimeOverviewRuntimeState
  runtimeRevision?: RuntimeRevisionReport
  counts?: Partial<GeneralResourceCounts>
}

interface InterfaceAPI {
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

interface InterfaceAddressDetailAPI {
  family?: string
  local?: string
  prefixlen?: number
  scope?: string | null
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
  trafficAvailable?: boolean
  trafficSampleStatus?: string
  trafficScope?: string
  directIncluded?: boolean
  counterEpoch?: number
  trafficAgeMs?: number | null
  lastTrafficSampleAt?: string | null
  sequence?: number
  runtime?: RuntimeOverviewRuntimeState
  runtimeRevision?: RuntimeRevisionReport
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

interface GroupSummaryAPI {
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

interface GeodataResourceAPI {
  available: boolean
  version: string
  categoryCount: number
  ruleCount?: number
  cidrCount?: number
  fileSize?: number
  sha256?: string | null
  updatedAt?: string | null
  lastError?: string | null
}

interface GeodataAPI {
  geosite: GeodataResourceAPI
  geoip: GeodataResourceAPI
  updated?: 'geosite' | 'geoip'
  runtimeReloadRequired?: boolean
  runtimeReloaded?: boolean
  runtimeReloadSource?: string
  runtimeReloadElapsed?: string
  runtimeReloadStatus?: unknown
  runtimeReloadMessage?: string
}

interface GeodataSourceAPI {
  kind: GeodataKind
  url: string
  defaultUrl: string
  usingDefault: boolean
  sourceType?: 'release' | 'direct'
  useProxy?: boolean
}

interface GeodataSettingsAPI {
  geosite: GeodataSourceAPI
  geoip: GeodataSourceAPI
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

function trafficOverviewQueryKey(scope: string, windowSec: number, maxPoints: number) {
  return webQueryKeys.traffic.overview(scope, windowSec, maxPoints)
}

function trafficCacheScope(endpointURL: string, token: string) {
  const input = `${normalizeEndpointURL(endpointURL)}\0${token}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `runtime-${(hash >>> 0).toString(16)}`
}

export function buildRuntimeEventsURL(endpointURL: string, windowSec: number, maxPoints: number) {
  return buildEventStreamURL(endpointURL, '/events/runtime', {
    windowSec,
    maxPoints,
  }).toString()
}

export function buildLogEventsURL(endpointURL: string, level: string, query: string, afterId?: number | null) {
  return buildEventStreamURL(endpointURL, '/events/logs', {
    level,
    q: query,
    after_id: afterId && afterId > 0 ? afterId : undefined,
  }).toString()
}

export function getModeRequest(apiClient: APIClientInterface) {
  return async (signal?: AbortSignal) => {
    const { values } = await apiClient.get<JSONStorageResponse>('/user/me/storage', { path: ['mode'] }, { signal })
    return values[0]
  }
}

export function getDefaultsRequest(apiClient: APIClientInterface) {
  return async (signal?: AbortSignal) => {
    const { values } = await apiClient.get<JSONStorageResponse>(
      '/user/me/storage',
      {
        path: ['defaultConfigID', 'defaultRoutingID', 'defaultDNSID', 'defaultGroupID'],
      },
      { signal },
    )
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
    runtime: state.runtime,
    runtimeRevision: state.runtimeRevision,
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

export function useDefaultsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  const { data } = useQuery({
    queryKey: webQueryKeys.storage(),
    queryFn: ({ signal }) => getDefaultsRequest(apiClient)(signal),
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

function trafficOverviewRefetchInterval() {
  return 1_000
}

export function useTrafficOverviewQuery(windowSec: number, maxPoints: number) {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)
  const [isStreamLive, setIsStreamLive] = useState(false)
  const [streamGeneration, setStreamGeneration] = useState(0)
  const lastFreshEventAt = useRef(0)
  const lastUpdatedAtMs = useRef(0)
  const lastDeltaSequence = useRef<number | null>(null)
  const freshEventStreak = useRef(0)
  const streamIdentity = useRef<string | null>(null)
  const reconnectAttemptedAt = useRef<number | null>(null)
  const groupSelectionGeneration = useRef<string | null>(null)
  const queryEnabled = isMockMode() || !!token
  const streamEnabled = !isMockMode() && !!token && typeof fetch !== 'undefined'
  const cacheScope = useMemo(() => trafficCacheScope(endpointURL, token), [endpointURL, token])
  const queryKey = useMemo(
    () => trafficOverviewQueryKey(cacheScope, windowSec, maxPoints),
    [cacheScope, maxPoints, windowSec],
  )
  const streamURL = useMemo(
    () => (streamEnabled ? buildRuntimeEventsURL(endpointURL, windowSec, maxPoints) : null),
    [endpointURL, maxPoints, streamEnabled, windowSec],
  )

  const markFresh = useCallback((payload: RuntimeOverviewAPI, promoteStream: boolean) => {
    if (!runtimeOverviewIsFresh(payload, lastUpdatedAtMs.current, lastDeltaSequence.current)) return false
    const updatedAtMs = Date.parse(payload.updatedAt)
    lastUpdatedAtMs.current = Math.max(lastUpdatedAtMs.current, updatedAtMs)
    if (Number.isFinite(payload.sequence)) lastDeltaSequence.current = payload.sequence!
    if (promoteStream) {
      lastFreshEventAt.current = Date.now()
      freshEventStreak.current = Math.min(freshEventStreak.current + 1, 3)
      if (freshEventStreak.current >= 2) setIsStreamLive(true)
      reconnectAttemptedAt.current = null
    }
    return true
  }, [])

  useEffect(() => {
    if (!streamURL) {
      setIsStreamLive(false)
      streamIdentity.current = null
      reconnectAttemptedAt.current = null
      return
    }

    if (streamIdentity.current !== streamURL) {
      streamIdentity.current = streamURL
      reconnectAttemptedAt.current = null
      lastUpdatedAtMs.current = 0
      lastDeltaSequence.current = null
    }
    setIsStreamLive(false)
    lastFreshEventAt.current = Date.now()
    freshEventStreak.current = 0
    groupSelectionGeneration.current = null

    const handleOverview = (data: string) => {
      try {
        const payload = JSON.parse(data) as RuntimeOverviewAPI
        if (!markFresh(payload, true)) return
        queryClient.setQueryData(queryKey, adaptRuntimeOverview(payload))
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleOverviewDelta = (data: string) => {
      try {
        const payload = JSON.parse(data) as RuntimeOverviewAPI
        if (!markFresh(payload, true)) return
        queryClient.setQueryData<TrafficOverviewQueryData>(queryKey, (previousData) =>
          mergeRuntimeOverviewDelta(previousData, payload, windowSec, maxPoints),
        )
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleStreamError = () => {
      setIsStreamLive(false)
      lastDeltaSequence.current = null
      lastUpdatedAtMs.current = 0
    }

    const unsubscribe = subscribeEventStream({
      url: streamURL,
      token,
      onMessage(message) {
        if (message.event === 'runtime.overview') {
          handleOverview(message.data)
        } else if (message.event === 'runtime.overview.delta') {
          handleOverviewDelta(message.data)
        } else if (message.event === 'runtime.group-selection') {
          groupSelectionGeneration.current = handleRuntimeGroupSelectionEvent(
            queryClient,
            message.data,
            groupSelectionGeneration.current,
          )
        } else if (message.event === 'runtime.error') {
          handleStreamError()
        }
      },
      onError: handleStreamError,
    })

    return () => {
      unsubscribe()
    }
  }, [markFresh, maxPoints, queryClient, queryKey, streamGeneration, streamURL, token, windowSec])

  useEffect(() => {
    const watchdog = window.setInterval(() => {
      if (!streamEnabled) return
      const age = lastFreshEventAt.current > 0 ? Date.now() - lastFreshEventAt.current : Number.POSITIVE_INFINITY
      if (age > 3_000) {
        freshEventStreak.current = 0
        setIsStreamLive(false)
      }
      if (age > 10_000 && reconnectAttemptedAt.current === null) {
        reconnectAttemptedAt.current = Date.now()
        lastFreshEventAt.current = Date.now()
        setStreamGeneration((generation) => generation + 1)
      }
    }, 1_000)
    const refreshOnVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (isStreamLive) return
      void queryClient.refetchQueries({ queryKey })
      if (Date.now() - lastFreshEventAt.current > 3_000 && reconnectAttemptedAt.current === null) {
        reconnectAttemptedAt.current = Date.now()
        setStreamGeneration((generation) => generation + 1)
      }
    }
    document.addEventListener('visibilitychange', refreshOnVisible)
    window.addEventListener('pageshow', refreshOnVisible)
    return () => {
      window.clearInterval(watchdog)
      document.removeEventListener('visibilitychange', refreshOnVisible)
      window.removeEventListener('pageshow', refreshOnVisible)
    }
  }, [isStreamLive, queryClient, queryKey, streamEnabled])

  useEffect(
    () => () => {
      queryClient.removeQueries({ queryKey, exact: true })
    },
    [queryClient, queryKey],
  )

  return useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<TrafficOverviewQueryData> => {
      const data = await apiClient.get<RuntimeOverviewAPI>('/runtime/overview', { windowSec, maxPoints }, { signal })
      const adapted = adaptRuntimeOverview(data)
      if (markFresh(data, false)) return adapted
      return queryClient.getQueryData<TrafficOverviewQueryData>(queryKey) ?? adapted
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

export function useNodeLatenciesQuery(refetchIntervalMs: number, enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.latency(),
    queryFn: async ({ signal }): Promise<NodeLatencyProbeResult[]> => {
      const data = await apiClient.get<{ items: NodeLatencyAPI[] }>('/nodes/latencies', undefined, { signal })
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
    ...nodeLatencyJobQueryOptions(apiClient, refetchIntervalMs),
    enabled: queryEnabled,
  })
}

export function useLogsQuery({ level, query, limit = 500 }: { level: string; query: string; limit?: number }) {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: [...webQueryKeys.log.items(), level, query, limit],
    queryFn: async ({ signal }): Promise<{ items: LogEntry[] }> => {
      return apiClient.get<{ items: LogEntry[] }>('/logs', { level, q: query, limit }, { signal })
    },
    enabled,
  })
}

export function useLogSettingsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.log.settings(),
    queryFn: async ({ signal }): Promise<LogSettings> => {
      return apiClient.get<LogSettings>('/logs/settings', undefined, { signal })
    },
    enabled,
  })
}

export function useRuntimeLogLevelQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.log.runtimeLevel(),
    queryFn: async ({ signal }): Promise<{ level: string }> => {
      return apiClient.get<{ level: string }>('/runtime/log-level', undefined, { signal })
    },
    enabled,
  })
}

export function useGeodataQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.geodata.status(),
    queryFn: async ({ signal }): Promise<GeodataView> => apiClient.get<GeodataAPI>('/geodata', undefined, { signal }),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useGeodataSettingsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.geodata.settings(),
    queryFn: async ({ signal }): Promise<GeodataSettingsView> =>
      apiClient.get<GeodataSettingsAPI>('/geodata/settings', undefined, { signal }),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
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

export function useUserQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.user(),
    queryFn: async ({ signal }): Promise<CurrentUserView> => {
      const user = await apiClient.get<CurrentUserView['user']>('/user/me', undefined, { signal })
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

function adaptGroupSummary(group: GroupSummaryAPI): GroupSummaryResource {
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
    addressDetails: Array.isArray(iface.addressDetails)
      ? iface.addressDetails
          .map(adaptInterfaceAddressDetail)
          .filter((detail): detail is InterfaceAddressDetail => detail !== null)
      : [],
    defaultRoutes: Array.isArray(iface.defaultRoutes) ? iface.defaultRoutes : [],
  }
}

function adaptInterfaceAddressDetail(detail: InterfaceAddressDetailAPI): InterfaceAddressDetail | null {
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
