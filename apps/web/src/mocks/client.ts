import type { APIClientInterface, APIQueryValue } from '~/apis/client'
import type { APIRequestOptions } from '~/apis/request_abort'
import type { ConfigGlobal, GeodataKind } from '~/apis/types'

import {
  getMockRuntimeOverview,
  isMockMode,
  MOCK_DEFAULT_IDS,
  mockConfigs,
  mockDNSs,
  mockGeneral,
  mockGroups,
  mockNodes,
  mockRoutings,
  mockSubscriptions,
  mockUser,
} from './data'

type QueryRecord = Record<string, APIQueryValue>
interface MockLatencyResult {
  id: string
  latencyMs: number
  alive: boolean
  testedAt: string
  message?: string | null
}

interface MockLatencyJob {
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

const absoluteOriginPattern = /^https?:\/\/[^/]+/
const groupIDPattern = /^group-(\d+)$/
const nodeIDPattern = /^node-(\d+)$/
const subscriptionIDPattern = /^sub-(\d+)$/
const subscriptionNodeIDPattern = /^sub(\d+)-node-(\d+)$/
const groupNodesPathPattern = /^\/groups\/([^/]+)\/nodes$/
const groupSubscriptionsPathPattern = /^\/groups\/([^/]+)\/subscriptions$/
const groupPathPattern = /^\/groups\/([^/]+)$/
const subscriptionRefreshPathPattern = /^\/subscriptions\/([^/]+)\/refresh$/
const geodataSettingsPathPattern = /^\/geodata\/(geosite|geoip)\/settings$/
const geodataUpdatePathPattern = /^\/geodata\/(geosite|geoip)\/update$/
const numericIDPattern = /(\d+)/
const daeIdentifierPattern = /^[A-Z_][\w-]*$/i
const MOCK_REQUEST_DELAY_MS = 20
const mockDefaultGeodataSourceUrls: Record<GeodataKind, string> = {
  geosite: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat',
  geoip: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat',
}
const mockLegacyGeodataReleaseApiUrls: Record<GeodataKind, string> = {
  geosite: 'https://api.github.com/repos/Loyalsoldier/v2ray-rules-dat/releases/latest',
  geoip: 'https://api.github.com/repos/Loyalsoldier/v2ray-rules-dat/releases/latest',
}
const mockGeodataDataFileNames: Record<GeodataKind, string> = {
  geosite: 'geosite.dat',
  geoip: 'geoip.dat',
}

const mockStorage = new Map<string, string>([
  ['mode', 'rule'],
  ['defaultConfigID', MOCK_DEFAULT_IDS.defaultConfigID],
  ['defaultRoutingID', MOCK_DEFAULT_IDS.defaultRoutingID],
  ['defaultDNSID', MOCK_DEFAULT_IDS.defaultDNSID],
  ['defaultGroupID', MOCK_DEFAULT_IDS.defaultGroupID],
])

const mockLatencyById = new Map<string, MockLatencyResult>()
let mockLatencyJob: MockLatencyJob | null = null
let mockNextLatencyJobID = 1
let mockRuntimeLogLevel = 'error'
let mockGeodataSourceUrls: Record<GeodataKind, string> = {
  geosite: '',
  geoip: '',
}
let mockGeodataSourceUseProxy: Record<GeodataKind, boolean> = {
  geosite: false,
  geoip: false,
}

function waitForMockRequest(signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error('mock API request aborted'))
  }

  return new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>
    const abort = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason ?? new Error('mock API request aborted'))
    }
    const finish = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    timeout = setTimeout(finish, MOCK_REQUEST_DELAY_MS)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
let mockGeodataStatus = {
  geosite: {
    available: true,
    version: '202606222314',
    categoryCount: 1420,
    ruleCount: 97240,
    fileSize: 10834567,
    sha256: 'mock-geosite-sha256',
    updatedAt: '2026-06-22T23:14:00Z',
    lastError: null,
  },
  geoip: {
    available: true,
    version: '202606182327',
    categoryCount: 268,
    cidrCount: 391845,
    fileSize: 9361728,
    sha256: 'mock-geoip-sha256',
    updatedAt: '2026-06-18T23:27:00Z',
    lastError: null,
  },
}
let mockLogSettings = {
  maxEntries: 10000,
  maxBytes: 50 * 1024 * 1024,
  minMaxEntries: 500,
  maxMaxEntries: 50000,
  minMaxBytes: 5 * 1024 * 1024,
  maxMaxBytes: 200 * 1024 * 1024,
}
let mockLogs = [
  {
    id: 1,
    ts: '2026-05-16T07:10:20+08:00',
    level: 'info',
    message: 'dae runtime started',
    fields: { phase: 'startup' },
  },
  {
    id: 2,
    ts: '2026-05-16T07:10:21+08:00',
    level: 'info',
    message: 'Ready',
  },
  {
    id: 3,
    ts: '2026-05-16T07:11:08+08:00',
    level: 'warn',
    message: 'subscription refresh completed with skipped nodes',
    fields: { subscription: 'Backup Provider' },
  },
]

interface SelectableMockResource {
  id: string
  selected?: boolean
}

function findStoredMockResource<T extends SelectableMockResource>(items: T[], storageKey: string): T | undefined {
  const storedID = mockStorage.get(storageKey)
  if (storedID) {
    const storedNumericID = optionalNumericID(storedID)
    const resource = items.find(
      (item) => item.id === storedID || (storedNumericID != null && numericID(item.id) === storedNumericID),
    )
    if (resource) return resource
  }

  return items.find((item) => item.selected) ?? items[0]
}

function currentMockConfig() {
  return findStoredMockResource(mockConfigs.configs, 'defaultConfigID')
}

function currentMockDNS() {
  return findStoredMockResource(mockDNSs.dnss, 'defaultDNSID')
}

function currentMockRouting() {
  return findStoredMockResource(mockRoutings.routings, 'defaultRoutingID')
}

function currentMockGroup() {
  return findStoredMockResource(mockGroups.groups, 'defaultGroupID')
}

function quoteDAEString(value: string) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function formatDAEIdentifier(value: string) {
  const trimmed = value.trim()
  return daeIdentifierPattern.test(trimmed) ? trimmed : quoteDAEString(trimmed)
}

function formatDAECSV(values: string[]) {
  return quoteDAEString(values.join(','))
}

function pushDAEValue(lines: string[], key: string, value: string | number | boolean | undefined | null) {
  if (value == null || value === '') return
  lines.push(`  ${key}: ${value}`)
}

function pushDAEQuotedValue(lines: string[], key: string, value: string | undefined | null) {
  if (!value) return
  lines.push(`  ${key}: ${quoteDAEString(value)}`)
}

function pushDAECSVValue(lines: string[], key: string, values: string[] | undefined | null) {
  if (!values?.length) return
  lines.push(`  ${key}: ${formatDAECSV(values)}`)
}

function formatMockGlobalConfig(global: ConfigGlobal) {
  const lines = ['global {']
  pushDAEValue(lines, 'log_level', global.logLevel)
  pushDAEValue(lines, 'tproxy_port', global.tproxyPort)
  pushDAEValue(lines, 'tproxy_port_protect', global.tproxyPortProtect)
  pushDAEValue(lines, 'pprof_port', global.pprofPort)
  pushDAEValue(lines, 'so_mark_from_dae', global.soMarkFromDae)
  pushDAEValue(lines, 'allow_insecure', global.allowInsecure)
  pushDAECSVValue(lines, 'tcp_check_url', global.tcpCheckUrl)
  pushDAEValue(lines, 'tcp_check_http_method', global.tcpCheckHttpMethod)
  pushDAECSVValue(lines, 'udp_check_dns', global.udpCheckDns)
  pushDAEValue(lines, 'check_interval', global.checkInterval)
  pushDAEValue(lines, 'check_tolerance', global.checkTolerance)
  pushDAECSVValue(lines, 'lan_interface', global.lanInterface)
  pushDAECSVValue(lines, 'wan_interface', global.wanInterface)
  pushDAEValue(lines, 'dial_mode', global.dialMode)
  pushDAEValue(lines, 'disable_waiting_network', global.disableWaitingNetwork)
  pushDAEValue(lines, 'enable_local_tcp_fast_redirect', global.enableLocalTcpFastRedirect)
  pushDAEValue(lines, 'auto_config_kernel_parameter', global.autoConfigKernelParameter)
  pushDAEValue(lines, 'sniffing_timeout', global.sniffingTimeout)
  pushDAEValue(lines, 'tls_implementation', global.tlsImplementation)
  pushDAEValue(lines, 'utls_imitate', global.utlsImitate)
  pushDAEValue(lines, 'mptcp', global.mptcp)
  pushDAEQuotedValue(lines, 'fallback_resolver', global.fallbackResolver)
  pushDAEQuotedValue(lines, 'bandwidth_max_tx', global.bandwidthMaxTx)
  pushDAEQuotedValue(lines, 'bandwidth_max_rx', global.bandwidthMaxRx)
  lines.push('}')
  return lines.join('\n')
}

function indentDAESectionBody(value: string) {
  return value
    .trim()
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `  ${line}`))
    .join('\n')
}

function wrapDAESection(name: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed) return ''
  return `${name} {\n${indentDAESectionBody(trimmed)}\n}`
}

function formatMockSubscriptionSection() {
  if (mockSubscriptions.subscriptions.length === 0) return ''
  const lines = ['subscription {']
  for (const subscription of mockSubscriptions.subscriptions) {
    const name = subscription.tag?.trim() || `subscription_${numericID(subscription.id)}`
    lines.push(`  ${formatDAEIdentifier(name)}: ${quoteDAEString(subscription.link)}`)
  }
  lines.push('}')
  return lines.join('\n')
}

function formatMockNodeSection() {
  if (mockNodes.nodes.items.length === 0) return ''
  const lines = ['node {']
  for (const node of mockNodes.nodes.items) {
    const name = node.tag?.trim() || node.name.trim() || `node_${numericID(node.id)}`
    lines.push(`  ${formatDAEIdentifier(name)}: ${quoteDAEString(node.link)}`)
  }
  lines.push('}')
  return lines.join('\n')
}

function formatMockGroupPolicy(group: (typeof mockGroups.groups)[number]) {
  if (group.policy !== 'fixed') return group.policy
  const fixedIndex = group.policyParams[0]?.val
  return fixedIndex ? `fixed(${fixedIndex})` : group.policy
}

function formatMockGroupSection(group: (typeof mockGroups.groups)[number]) {
  const lines = [
    'group {',
    `  ${formatDAEIdentifier(group.name)} {`,
    `    policy: ${formatMockGroupPolicy(group)}`,
    '  }',
    '}',
  ]
  return lines.join('\n')
}

function generateMockDAEConfigContent() {
  const sections: string[] = []
  const config = currentMockConfig()
  const dns = currentMockDNS()
  const group = currentMockGroup()
  const routing = currentMockRouting()

  if (config) sections.push(formatMockGlobalConfig(config.global))
  sections.push(formatMockSubscriptionSection())
  sections.push(formatMockNodeSection())
  if (dns) sections.push(wrapDAESection('dns', dns.dns.string))
  if (group) sections.push(formatMockGroupSection(group))
  if (routing) sections.push(wrapDAESection('routing', routing.routing.string))

  return `${sections.filter(Boolean).join('\n\n')}\n`
}

function otherMockGeodataKind(kind: GeodataKind): GeodataKind {
  return kind === 'geosite' ? 'geoip' : 'geosite'
}

function normalizeMockComparableUrl(value: string) {
  try {
    return new URL(value.trim()).href
  } catch {
    return value.trim()
  }
}

function mockGeodataSource(kind: GeodataKind) {
  const customUrl = mockGeodataSourceUrls[kind].trim()
  const defaultUrl = mockDefaultGeodataSourceUrls[kind]
  const url = customUrl || defaultUrl
  return {
    kind,
    url,
    defaultUrl,
    usingDefault: !customUrl,
    sourceType: mockGeodataSourceType(kind, url),
    useProxy: mockGeodataSourceUseProxy[kind],
  }
}

function mockGeodataSettings() {
  return {
    geosite: mockGeodataSource('geosite'),
    geoip: mockGeodataSource('geoip'),
  }
}

function validateMockGeodataSource(kind: GeodataKind, rawUrl: string) {
  const value = rawUrl.trim()
  if (!value) throw new Error('geodata source url is empty')
  if (value.length > 2048) throw new Error('geodata source url is too long')

  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported geodata source url scheme: ${url.protocol.replace(':', '')}`)
  }

  const otherKind = otherMockGeodataKind(kind)
  const ownReleaseApiUrl = normalizeMockComparableUrl(mockLegacyGeodataReleaseApiUrls[kind])
  const otherReleaseApiUrl = normalizeMockComparableUrl(mockLegacyGeodataReleaseApiUrls[otherKind])
  const usesOtherOnlyReleaseApi =
    otherReleaseApiUrl !== ownReleaseApiUrl && normalizeMockComparableUrl(value) === otherReleaseApiUrl
  if (
    normalizeMockComparableUrl(value) === normalizeMockComparableUrl(mockDefaultGeodataSourceUrls[otherKind]) ||
    usesOtherOnlyReleaseApi
  ) {
    throw new Error(`${kind} source cannot use ${otherKind} default update url`)
  }
  const lastSegment = url.pathname.split('/').pop() ?? ''
  if (lastSegment.toLowerCase() === mockGeodataDataFileNames[otherKind].toLowerCase()) {
    throw new Error(`${kind} source cannot use ${otherKind} data file url`)
  }

  return url.href
}

function mockGeodataSourceType(kind: GeodataKind, rawUrl: string): 'release' | 'direct' {
  if (normalizeMockComparableUrl(rawUrl) === normalizeMockComparableUrl(mockLegacyGeodataReleaseApiUrls[kind])) {
    return 'release'
  }
  const url = new URL(rawUrl)
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.at(-1) === 'latest' && segments.at(-2) === 'releases') {
    return 'release'
  }
  return 'direct'
}

function setMockGeodataSource(kind: GeodataKind, body: unknown) {
  const payload = body as { url?: string; restoreDefault?: boolean; useProxy?: boolean }
  if (typeof payload.useProxy === 'boolean') {
    mockGeodataSourceUseProxy = { ...mockGeodataSourceUseProxy, [kind]: payload.useProxy }
  }
  if (payload.restoreDefault) {
    mockGeodataSourceUrls = { ...mockGeodataSourceUrls, [kind]: '' }
    return mockGeodataSource(kind)
  }
  if (payload.url === undefined) {
    return mockGeodataSource(kind)
  }
  const url = validateMockGeodataSource(kind, payload.url ?? '')
  mockGeodataSourceUrls = {
    ...mockGeodataSourceUrls,
    [kind]:
      normalizeMockComparableUrl(url) === normalizeMockComparableUrl(mockDefaultGeodataSourceUrls[kind]) ? '' : url,
  }
  return mockGeodataSource(kind)
}

function updateMockGeodata(kind: GeodataKind) {
  const resource = {
    ...mockGeodataStatus[kind],
    available: true,
    updatedAt: new Date().toISOString(),
    lastError: null,
  }
  mockGeodataStatus = { ...mockGeodataStatus, [kind]: resource }
  return {
    [kind]: resource,
    updated: kind,
  }
}

function buildMockDAEBundle() {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    mode: mockStorage.get('mode') || 'rule',
    defaults: {
      configId: optionalNumericID(mockStorage.get('defaultConfigID')),
      routingId: optionalNumericID(mockStorage.get('defaultRoutingID')),
      dnsId: optionalNumericID(mockStorage.get('defaultDNSID')),
      groupId: optionalNumericID(mockStorage.get('defaultGroupID')),
    },
    selected: {
      configId: optionalNumericID(mockConfigs.configs.find((config) => config.selected)?.id),
      routingId: optionalNumericID(mockRoutings.routings.find((routing) => routing.selected)?.id),
      dnsId: optionalNumericID(mockDNSs.dnss.find((dns) => dns.selected)?.id),
    },
    configs: mockConfigs.configs.map((config) => ({
      id: numericID(config.id),
      name: config.name,
      global: formatMockGlobalConfig(config.global),
    })),
    dnss: mockDNSs.dnss.map((dns) => ({
      id: numericID(dns.id),
      name: dns.name,
      dns: dns.dns.string,
    })),
    routings: mockRoutings.routings.map((routing) => ({
      id: numericID(routing.id),
      name: routing.name,
      routing: routing.routing.string,
    })),
    subscriptions: mockSubscriptions.subscriptions.map((subscription) => ({
      id: numericID(subscription.id),
      updatedAt: subscription.updatedAt,
      link: subscription.link,
      cronExp: subscription.cronExp,
      cronEnable: subscription.cronEnable,
      useProxy: subscription.useProxy,
      status: subscription.status,
      info: subscription.info,
      tag: subscription.tag ?? null,
    })),
    nodes: mockNodes.nodes.items.map((node) => ({
      id: numericID(node.id),
      link: node.link,
      name: node.name,
      address: node.address,
      protocol: node.protocol,
      tag: node.tag ?? null,
      subscriptionId: optionalNumericID(node.subscriptionID),
    })),
    groups: mockGroups.groups.map((group) => ({
      id: numericID(group.id),
      name: group.name,
      policy: group.policy,
      policyParams: group.policyParams,
      nodeIds: group.nodes.map((node) => numericID(node.id)),
      subscriptionBindings: group.subscriptions.map((subscription) => ({
        subscriptionId: numericID(subscription.subscription.id),
        nameFilterRegex: subscription.nameFilterRegex ?? null,
      })),
    })),
  }
}

export class MockAPIClient implements APIClientInterface {
  constructor(private readonly endpoint: string) {}

  get<T>(path: string, query?: QueryRecord, options?: APIRequestOptions): Promise<T> {
    return this.handle<T>('GET', path, undefined, query, options)
  }

  post<T>(path: string, body?: unknown, query?: QueryRecord, options?: APIRequestOptions): Promise<T> {
    return this.handle<T>('POST', path, body, query, options)
  }

  put<T>(path: string, body?: unknown, query?: QueryRecord, options?: APIRequestOptions): Promise<T> {
    return this.handle<T>('PUT', path, body, query, options)
  }

  patch<T>(path: string, body?: unknown, query?: QueryRecord, options?: APIRequestOptions): Promise<T> {
    return this.handle<T>('PATCH', path, body, query, options)
  }

  delete<T>(path: string, body?: unknown, query?: QueryRecord, options?: APIRequestOptions): Promise<T> {
    return this.handle<T>('DELETE', path, body, query, options)
  }

  private async handle<T>(
    method: string,
    rawPath: string,
    body?: unknown,
    query?: QueryRecord,
    options?: APIRequestOptions,
  ): Promise<T> {
    await waitForMockRequest(options?.signal)

    const path = rawPath.replace(this.endpoint, '').replace(absoluteOriginPattern, '')

    switch (`${method} ${path}`) {
      case 'GET /auth/status':
        return { numberUsers: 1 } as T
      case 'POST /auth/token':
      case 'POST /auth/users':
        return { token: 'mock-token' } as T
      case 'GET /health':
        return { healthCheck: 1 } as T
      case 'GET /user/me':
        return mockUser.user as T
      case 'GET /general/state':
        return {
          ...mockGeneral.general.dae,
          counts: mockGeneralResourceCounts(),
        } as T
      case 'GET /general/interfaces':
        return {
          items: mockGeneral.general.interfaces.map((iface) => ({
            name: iface.name,
            index: iface.index,
            up: iface.up,
            addresses: iface.addresses,
            addressDetails: iface.addressDetails,
            defaultRoutes: iface.defaultRoutes,
          })),
        } as T
      case 'GET /runtime/overview':
        return getMockRuntimeOverview(toQueryNumber(query?.windowSec, 60), toQueryNumber(query?.maxPoints, 240)) as T
      case 'GET /runtime/log-level':
        return { level: mockRuntimeLogLevel } as T
      case 'GET /logs':
        return { items: filterMockLogs(query) } as T
      case 'GET /logs/settings':
        return mockLogSettings as T
      case 'GET /geodata':
        return mockGeodataStatus as T
      case 'GET /geodata/settings':
        return mockGeodataSettings() as T
      case 'GET /nodes/latencies':
        return { items: Array.from(mockLatencyById.values()), job: mockLatencyJob } as T
      case 'POST /nodes/latencies':
        return updateMockLatencyJob(body) as T
      case 'GET /nodes/latencies/job':
        return { job: mockLatencyJob } as T
      case 'GET /nodes':
        if (toQueryBool(query?.independent) === false) {
          const subscriptionNodes = mockSubscriptions.subscriptions.flatMap((subscription) =>
            subscription.nodes.items.map((node) => toMockNodeAPI(node, subscription.id)),
          )
          return {
            items: subscriptionNodes,
            totalCount: subscriptionNodes.length,
          } as T
        }
        return {
          items: mockNodes.nodes.items.map((node) => toMockNodeAPI(node)),
          totalCount: mockNodes.nodes.items.length,
        } as T
      case 'GET /subscriptions':
        return {
          items: mockSubscriptions.subscriptions.map((subscription) => ({
            id: numericID(subscription.id),
            tag: subscription.tag,
            status: subscription.status,
            link: subscription.link,
            info: subscription.info,
            updatedAt: subscription.updatedAt,
            cronExp: subscription.cronExp,
            cronEnable: subscription.cronEnable,
            useProxy: subscription.useProxy,
            nodeCount: subscription.nodes.items.length,
            ...(toQueryArray(query?.expand).includes('nodes')
              ? {
                  nodes: {
                    items: subscription.nodes.items.map((node) => toMockNodeAPI(node, subscription.id)),
                    totalCount: subscription.nodes.items.length,
                  },
                }
              : {}),
          })),
        } as T
      case 'GET /groups':
        if (toQueryBool(query?.summary)) {
          return {
            items: mockGroups.groups.map((group) => {
              const subscriptions = group.subscriptions.map(materializeMockGroupSubscriptionBinding)
              const materializedCandidates = uniqueMockNodes([
                ...group.nodes,
                ...subscriptions.flatMap((binding) => binding.matchedNodes),
              ])
              return {
                id: numericID(group.id),
                name: group.name,
                policy: group.policy,
                policyParams: group.policyParams,
                version: 1,
                nodeCount: group.nodes.length,
                subscriptionCount: group.subscriptions.length,
                firstNode: group.nodes[0] ? toMockNodeAPI(group.nodes[0]) : null,
                sampleNodes: group.nodes.slice(0, 5).map((node) => toMockNodeAPI(node)),
                materializedCandidateCount: materializedCandidates.length,
                sampleMaterializedCandidates: materializedCandidates.slice(0, 5).map((node) => toMockNodeAPI(node)),
                currentNode: materializedCandidates[0] ? toMockNodeAPI(materializedCandidates[0]) : null,
                bestNode: materializedCandidates[0] ? toMockNodeAPI(materializedCandidates[0]) : null,
                subscriptions: subscriptions.map((binding) => ({
                  subscriptionId: numericID(binding.subscription.id),
                  nameFilterRegex: binding.nameFilterRegex,
                  matchedCount: binding.matchedCount,
                  sampleMatchedNodes: binding.matchedNodes.slice(0, 5).map((node) => toMockNodeAPI(node)),
                  updatedAt: binding.subscription.updatedAt,
                  status: binding.subscription.status,
                  info: binding.subscription.info,
                  link: binding.subscription.link,
                  tag: binding.subscription.tag,
                })),
              }
            }),
          } as T
        }
        return {
          items: mockGroups.groups.map((group) => ({
            id: numericID(group.id),
            name: group.name,
            policy: group.policy,
            policyParams: group.policyParams,
            nodes: group.nodes.map((node) => toMockNodeAPI(node)),
            subscriptions: group.subscriptions.map(materializeMockGroupSubscriptionBinding).map((binding) => ({
              subscriptionId: numericID(binding.subscription.id),
              nameFilterRegex: binding.nameFilterRegex,
              matchedCount: binding.matchedCount,
              matchedNodes: binding.matchedNodes.map((node) => toMockNodeAPI(node)),
              updatedAt: binding.subscription.updatedAt,
              status: binding.subscription.status,
              info: binding.subscription.info,
              link: binding.subscription.link,
              tag: binding.subscription.tag,
            })),
          })),
        } as T
      case 'GET /routings':
        if (toQueryBool(query?.summary)) {
          return {
            items: mockRoutings.routings.map((routing, index) => ({
              id: numericID(routing.id),
              name: routing.name,
              selected: routing.selected,
              version: index + 1,
              parseStatus: 'ok',
              parseError: null,
            })),
          } as T
        }
        return {
          items: mockRoutings.routings.map((routing) => ({
            id: numericID(routing.id),
            name: routing.name,
            selected: routing.selected,
            parsedRouting: routing.routing,
          })),
        } as T
      case 'GET /dns':
        if (toQueryBool(query?.summary)) {
          return {
            items: mockDNSs.dnss.map((dns, index) => ({
              id: numericID(dns.id),
              name: dns.name,
              selected: dns.selected,
              version: index + 1,
              parseStatus: 'ok',
              parseError: null,
            })),
          } as T
        }
        return {
          items: mockDNSs.dnss.map((dns) => ({
            id: numericID(dns.id),
            name: dns.name,
            selected: dns.selected,
            parsedDns: dns.dns,
          })),
        } as T
      case 'GET /configs':
        if (toQueryBool(query?.summary)) {
          return {
            items: mockConfigs.configs.map((config, index) => ({
              id: numericID(config.id),
              name: config.name,
              selected: config.selected,
              version: index + 1,
              parseStatus: 'ok',
              parseError: null,
            })),
          } as T
        }
        return {
          items: mockConfigs.configs.map((config) => ({
            id: numericID(config.id),
            name: config.name,
            global: formatMockGlobalConfig(config.global),
            selected: config.selected,
            parsedGlobal: config.global,
          })),
        } as T
    }

    if (method === 'GET' && path.startsWith('/configs/')) {
      const id = path.split('/')[2]
      const config = mockConfigs.configs.find((item) => item.id === id || String(numericID(item.id)) === id)
      if (!config) {
        throw new Error(`Mock config not found: ${id}`)
      }
      return {
        id: numericID(config.id),
        name: config.name,
        global: formatMockGlobalConfig(config.global),
        selected: config.selected,
        parsedGlobal: config.global,
      } as T
    }

    if (method === 'GET' && path.startsWith('/subscriptions/') && path.endsWith('/nodes')) {
      const id = path.split('/')[2]
      const subscription = mockSubscriptions.subscriptions.find(
        (item) => item.id === id || String(numericID(item.id)) === id,
      )
      return {
        items: subscription?.nodes.items || [],
        totalCount: subscription?.nodes.items.length || 0,
      } as T
    }

    if (method === 'GET' && path.startsWith('/user/me/storage')) {
      const paths = toQueryArray(query?.path)
      return { values: paths.map((pathKey) => mockStorage.get(pathKey) || '') } as T
    }

    if (method === 'POST' && path === '/user/me/default-resources') {
      const payload = body as { mode?: string }
      if (payload.mode) {
        mockStorage.set('mode', payload.mode)
      }
      return {
        defaultConfigID: mockStorage.get('defaultConfigID') || '',
        defaultRoutingID: mockStorage.get('defaultRoutingID') || '',
        defaultDNSID: mockStorage.get('defaultDNSID') || '',
        defaultGroupID: mockStorage.get('defaultGroupID') || '',
        mode: mockStorage.get('mode') || 'rule',
      } as T
    }

    if (method === 'GET' && path === '/user/me/dae-bundle') {
      return buildMockDAEBundle() as T
    }

    if (method === 'GET' && path === '/user/me/dae-config-file') {
      return {
        filename: 'mock.dae',
        content: generateMockDAEConfigContent(),
        warnings: [],
      } as T
    }

    if (method === 'POST' && path === '/user/me/dae-config-file/preview') {
      const bundle = await this.handle<unknown>('GET', '/user/me/dae-bundle')
      return {
        bundle,
        warnings: [
          {
            level: 'lossy',
            code: 'group_filter_flattened',
            message: 'Mock preview warning',
          },
        ],
      } as T
    }

    if (method === 'POST' && path === '/configs/parsed') {
      const payload = body as { global?: string; parsedGlobal?: unknown }
      return {
        global: payload.global || 'global {}',
        parsedGlobal: payload.parsedGlobal || mockConfigs.configs[0]?.global || {},
      } as T
    }

    if (method === 'PUT' && path === '/user/me/dae-bundle') {
      const payload = body as {
        mode?: string
        defaults?: { configId?: number; routingId?: number; dnsId?: number; groupId?: number }
      }
      if (payload.defaults?.configId != null) mockStorage.set('defaultConfigID', String(payload.defaults.configId))
      if (payload.defaults?.routingId != null) mockStorage.set('defaultRoutingID', String(payload.defaults.routingId))
      if (payload.defaults?.dnsId != null) mockStorage.set('defaultDNSID', String(payload.defaults.dnsId))
      if (payload.defaults?.groupId != null) mockStorage.set('defaultGroupID', String(payload.defaults.groupId))
      if (payload.mode) mockStorage.set('mode', payload.mode)
      return { imported: true } as T
    }

    if (method === 'PUT' && path === '/user/me/dae-config-file') {
      return {
        imported: true,
        warnings: [],
      } as T
    }

    if (method === 'PUT' && path === '/user/me/storage') {
      const payload = body as { paths?: string[]; values?: string[] }
      for (let index = 0; index < (payload.paths?.length || 0); index++) {
        const pathKey = payload.paths?.[index]
        const value = payload.values?.[index]
        if (pathKey && value != null) {
          mockStorage.set(pathKey, value)
        }
      }
      return { updated: payload.paths?.length || 0 } as T
    }

    if (method === 'PATCH' && path === '/user/me') {
      return {
        username: (body as { username?: string }).username || mockUser.user.username,
        name: (body as { name?: string }).name || mockUser.user.name,
        avatar: (body as { avatar?: string }).avatar || mockUser.user.avatar,
      } as T
    }

    if (method === 'POST' && path === '/user/me/password') {
      return { token: 'mock-token' } as T
    }

    if (method === 'POST' && path === '/runtime/reload') {
      return { applied: 1, dry: (body as { dry?: boolean })?.dry || false } as T
    }

    if (method === 'POST' && path === '/runtime/stop') {
      return { stopped: true } as T
    }

    if (method === 'PATCH' && path === '/runtime/log-level') {
      const payload = body as { level?: string }
      if (payload.level) {
        mockRuntimeLogLevel = payload.level
      }
      return { level: mockRuntimeLogLevel } as T
    }

    if (method === 'PATCH' && path === '/logs/settings') {
      const payload = body as { maxEntries?: number; maxBytes?: number }
      mockLogSettings = {
        ...mockLogSettings,
        maxEntries: payload.maxEntries ?? mockLogSettings.maxEntries,
        maxBytes: payload.maxBytes ?? mockLogSettings.maxBytes,
      }
      return mockLogSettings as T
    }

    const geodataSettingsMatch = path.match(geodataSettingsPathPattern)
    if (method === 'PATCH' && geodataSettingsMatch) {
      return setMockGeodataSource(geodataSettingsMatch[1] as GeodataKind, body) as T
    }

    const geodataUpdateMatch = path.match(geodataUpdatePathPattern)
    if (method === 'POST' && geodataUpdateMatch) {
      return updateMockGeodata(geodataUpdateMatch[1] as GeodataKind) as T
    }

    if (method === 'DELETE' && path === '/logs') {
      mockLogs = []
      return { cleared: true } as T
    }

    const groupNodesMatch = path.match(groupNodesPathPattern)
    if (groupNodesMatch && (method === 'POST' || method === 'DELETE')) {
      const payload = body as { nodeIds?: number[] }
      const updated =
        method === 'POST'
          ? addMockGroupNodes(groupNodesMatch[1], payload.nodeIds ?? [])
          : deleteMockGroupNodes(groupNodesMatch[1], payload.nodeIds ?? [])
      return { updated } as T
    }

    const groupSubscriptionsMatch = path.match(groupSubscriptionsPathPattern)
    if (groupSubscriptionsMatch && (method === 'POST' || method === 'DELETE')) {
      const payload = body as { subscriptionIds?: number[]; nameFilterRegex?: string | null }
      const updated =
        method === 'POST'
          ? addMockGroupSubscriptions(
              groupSubscriptionsMatch[1],
              payload.subscriptionIds ?? [],
              payload.nameFilterRegex ?? null,
            )
          : deleteMockGroupSubscriptions(groupSubscriptionsMatch[1], payload.subscriptionIds ?? [])
      return { updated } as T
    }

    const subscriptionRefreshMatch = path.match(subscriptionRefreshPathPattern)
    if (method === 'POST' && subscriptionRefreshMatch) {
      const id = refreshMockSubscription(subscriptionRefreshMatch[1])
      return { id } as T
    }

    const groupMatch = path.match(groupPathPattern)
    if (method === 'DELETE' && groupMatch) {
      return { removed: deleteMockGroup(groupMatch[1]) } as T
    }

    if (method === 'POST' && (path.endsWith('/select') || path.endsWith('/refresh'))) {
      return { applied: 1, selectedId: 1, id: 1 } as T
    }

    if (method === 'DELETE' && (path === '/nodes' || path === '/subscriptions')) {
      return { removed: 1 } as T
    }

    if (method === 'DELETE') {
      return undefined as T
    }

    if (method === 'POST' && path === '/nodes') {
      return { items: [{ link: 'mock-link', node: { id: Date.now() } }] } as T
    }

    if (method === 'POST' && path === '/subscriptions') {
      return {
        link: 'https://example.com/sub',
        subscription: { id: Date.now() },
        nodeImportResult: [{ node: { id: Date.now() + 1 } }],
      } as T
    }

    if (method === 'POST') {
      return { id: Date.now() } as T
    }

    if (method === 'PUT') {
      return { id: 1 } as T
    }

    throw new Error(`Mock API not implemented: ${method} ${path}`)
  }
}

function toQueryArray(value: APIQueryValue): string[] {
  if (Array.isArray(value)) {
    return value.map(String)
  }
  if (value == null) {
    return []
  }
  return [String(value)]
}

function toQueryBool(value: APIQueryValue): boolean {
  return toQueryArray(value).some((item) => item === 'true' || item === '1' || item === 'yes' || item === 'on')
}

function toQueryNumber(value: APIQueryValue, fallback: number): number {
  if (Array.isArray(value)) {
    const parsed = Number(value[0])
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function filterMockLogs(query?: QueryRecord) {
  const level = String(query?.level || 'all').toLowerCase()
  const keyword = String(query?.q || '').toLowerCase()
  const limit = toQueryNumber(query?.limit, 500)
  return mockLogs
    .filter((entry) => level === 'all' || !level || entry.level === level)
    .filter((entry) => {
      if (!keyword) return true
      const fields = Object.entries(entry.fields || {})
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')
      return `${entry.message} ${fields}`.toLowerCase().includes(keyword)
    })
    .slice(-limit)
}

function mockGeneralResourceCounts() {
  return {
    configs: mockConfigs.configs.length,
    dns: mockDNSs.dnss.length,
    routings: mockRoutings.routings.length,
    groups: mockGroups.groups.length,
    nodes: mockNodes.nodes.items.length,
    subscriptions: mockSubscriptions.subscriptions.length,
    logs: mockLogs.length,
  }
}

function numericID(value: string | number): number {
  const text = String(value)
  const groupMatch = text.match(groupIDPattern)
  if (groupMatch) return Number.parseInt(groupMatch[1], 10)
  const nodeMatch = text.match(nodeIDPattern)
  if (nodeMatch) return Number.parseInt(nodeMatch[1], 10)
  const subscriptionMatch = text.match(subscriptionIDPattern)
  if (subscriptionMatch) return Number.parseInt(subscriptionMatch[1], 10)
  const subscriptionNodeMatch = text.match(subscriptionNodeIDPattern)
  if (subscriptionNodeMatch) {
    return Number.parseInt(subscriptionNodeMatch[1], 10) * 100 + Number.parseInt(subscriptionNodeMatch[2], 10)
  }
  const match = text.match(numericIDPattern)
  return match ? Number.parseInt(match[1], 10) : 0
}

function optionalNumericID(value?: string | number | null): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = numericID(value)
  return parsed > 0 ? parsed : undefined
}

function allMockLatencyNodeIds() {
  const ids = new Set<string>()
  const addID = (id: string | number) => {
    ids.add(String(id))

    const parsed = numericID(id)
    if (parsed > 0) {
      ids.add(String(parsed))
    }
  }

  for (const node of mockNodes.nodes.items) {
    addID(node.id)
  }

  for (const subscription of mockSubscriptions.subscriptions) {
    for (const node of subscription.nodes.items) {
      addID(node.id)
    }
  }

  for (const group of mockGroups.groups) {
    for (const node of group.nodes) {
      addID(node.id)
    }
    for (const binding of group.subscriptions.map(materializeMockGroupSubscriptionBinding)) {
      for (const node of binding.matchedNodes) {
        addID(node.id)
      }
    }
  }

  return Array.from(ids)
}

function uniqueMockNodes<T extends { id: string; tag?: string | null; name: string }>(nodes: T[]) {
  const seen = new Set<string>()
  const out: T[] = []
  for (const node of nodes) {
    const identity = (node.tag?.trim() || node.name.trim() || node.id).trim()
    if (seen.has(identity)) continue
    seen.add(identity)
    out.push(node)
  }
  return out
}

function toMockNodeAPI(
  node: {
    id: string
    link: string
    name: string
    address?: string | null
    protocol?: string | null
    tag?: string | null
    subscriptionID?: string | null
  },
  fallbackSubscriptionID?: string | null,
) {
  const subscriptionID = node.subscriptionID ?? fallbackSubscriptionID ?? null
  return {
    id: numericID(node.id),
    link: node.link,
    name: node.name,
    address: node.address ?? '',
    protocol: node.protocol ?? '',
    tag: node.tag ?? null,
    subscriptionId: subscriptionID ? numericID(subscriptionID) : null,
  }
}

function findMockGroup(groupID: string | number) {
  const id = numericID(groupID)
  return mockGroups.groups.find((group) => numericID(group.id) === id)
}

function findMockSubscription(subscriptionID: string | number) {
  const id = numericID(subscriptionID)
  return mockSubscriptions.subscriptions.find((subscription) => numericID(subscription.id) === id)
}

function findMockNode(nodeID: string | number) {
  const id = numericID(nodeID)
  const manualNode = mockNodes.nodes.items.find((node) => numericID(node.id) === id)
  if (manualNode) {
    return {
      ...manualNode,
      address: manualNode.address ?? '',
      tag: manualNode.tag ?? null,
      subscriptionID: null,
    }
  }

  for (const subscription of mockSubscriptions.subscriptions) {
    const subscriptionNode = subscription.nodes.items.find((node) => numericID(node.id) === id)
    if (subscriptionNode) {
      return {
        ...subscriptionNode,
        address: '',
        tag: null,
        subscriptionID: subscription.id,
      }
    }
  }

  return null
}

function compileMockNameFilter(nameFilterRegex?: string | null) {
  const trimmed = nameFilterRegex?.trim()
  return trimmed ? new RegExp(trimmed) : null
}

function mockSubscriptionMatchedNodes(subscriptionID: string | number, nameFilterRegex?: string | null) {
  const subscription = findMockSubscription(subscriptionID)
  if (!subscription) return []

  const regex = compileMockNameFilter(nameFilterRegex)
  return subscription.nodes.items
    .filter((node) => !regex || regex.test(node.name))
    .map((node) => ({
      ...node,
      address: '',
      tag: null,
      subscriptionID: subscription.id,
    }))
}

function materializeMockGroupSubscriptionBinding(binding: (typeof mockGroups.groups)[number]['subscriptions'][number]) {
  const subscription = findMockSubscription(binding.subscription.id)
  const matchedNodes = mockSubscriptionMatchedNodes(binding.subscription.id, binding.nameFilterRegex)

  return {
    ...binding,
    subscription: subscription
      ? {
          id: subscription.id,
          updatedAt: subscription.updatedAt,
          tag: subscription.tag,
          link: subscription.link,
          status: subscription.status,
          info: subscription.info,
        }
      : binding.subscription,
    matchedCount: matchedNodes.length,
    matchedNodes,
  }
}

function addMockGroupNodes(groupID: string | number, nodeIDs: number[]) {
  const group = findMockGroup(groupID)
  if (!group) return 0

  let updated = 0
  const existingNodeIDs = new Set(group.nodes.map((node) => numericID(node.id)))
  for (const nodeID of nodeIDs) {
    if (existingNodeIDs.has(nodeID)) continue

    const node = findMockNode(nodeID)
    if (!node) continue

    group.nodes.push(node)
    existingNodeIDs.add(nodeID)
    updated += 1
  }

  return updated
}

function deleteMockGroupNodes(groupID: string | number, nodeIDs: number[]) {
  const group = findMockGroup(groupID)
  if (!group) return 0

  const deletedNodeIDs = new Set(nodeIDs)
  const before = group.nodes.length
  group.nodes = group.nodes.filter((node) => !deletedNodeIDs.has(numericID(node.id)))
  return before - group.nodes.length
}

function addMockGroupSubscriptions(
  groupID: string | number,
  subscriptionIDs: number[],
  nameFilterRegex: string | null,
) {
  const group = findMockGroup(groupID)
  if (!group) return 0
  compileMockNameFilter(nameFilterRegex)

  let updated = 0
  const existingSubscriptionIDs = new Set(group.subscriptions.map((binding) => numericID(binding.subscription.id)))

  for (const subscriptionID of subscriptionIDs) {
    if (existingSubscriptionIDs.has(subscriptionID)) continue

    const subscription = findMockSubscription(subscriptionID)
    if (!subscription) continue

    group.subscriptions.push({
      matchedCount: mockSubscriptionMatchedNodes(subscription.id, nameFilterRegex).length,
      nameFilterRegex,
      subscription: {
        id: subscription.id,
        updatedAt: subscription.updatedAt,
        tag: subscription.tag,
        link: subscription.link,
        status: subscription.status,
        info: subscription.info,
      },
      matchedNodes: [],
    })
    existingSubscriptionIDs.add(subscriptionID)
    updated += 1
  }

  return updated
}

function deleteMockGroupSubscriptions(groupID: string | number, subscriptionIDs: number[]) {
  const group = findMockGroup(groupID)
  if (!group) return 0

  const deletedSubscriptionIDs = new Set(subscriptionIDs)
  const before = group.subscriptions.length
  group.subscriptions = group.subscriptions.filter(
    (binding) => !deletedSubscriptionIDs.has(numericID(binding.subscription.id)),
  )
  return before - group.subscriptions.length
}

function deleteMockGroup(groupID: string | number) {
  const id = numericID(groupID)
  const before = mockGroups.groups.length
  mockGroups.groups = mockGroups.groups.filter((group) => numericID(group.id) !== id)
  return before - mockGroups.groups.length
}

function refreshMockSubscription(subscriptionID: string | number) {
  const subscription = findMockSubscription(subscriptionID)
  if (!subscription) return 0

  const nextIndex = subscription.nodes.items.length + 1
  subscription.nodes.items.push({
    id: `sub${numericID(subscription.id)}-node-${nextIndex}`,
    link: 'vless://refresh.example.invalid',
    name: `Subscription-Refresh-${String(nextIndex).padStart(2, '0')}`,
    address: 'refresh.example.invalid:443',
    protocol: 'vless',
  })
  subscription.updatedAt = new Date().toISOString()
  return numericID(subscription.id)
}

function requestedMockLatencyNodeIds(body: unknown) {
  const ids = (body as { ids?: unknown })?.ids
  if (!Array.isArray(ids)) return allMockLatencyNodeIds()

  const allIds = allMockLatencyNodeIds()
  const requestedIds = new Set<string>()

  for (const rawId of ids) {
    const id = String(rawId)
    if (!id || id === 'NaN' || id === '0' || id === 'null' || id === 'undefined') {
      continue
    }

    requestedIds.add(id)

    const parsed = numericID(id)
    if (parsed <= 0) {
      continue
    }

    requestedIds.add(String(parsed))
    for (const candidate of allIds) {
      if (numericID(candidate) === parsed) {
        requestedIds.add(candidate)
      }
    }
  }

  return requestedIds.size > 0 ? Array.from(requestedIds) : allIds
}

function updateMockLatencies(body: unknown) {
  const testedAt = new Date().toISOString()

  const results = requestedMockLatencyNodeIds(body).map((id): MockLatencyResult => {
    const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return {
      id,
      latencyMs: 28 + (seed % 86),
      alive: true,
      testedAt,
      message: 'mock',
    }
  })

  for (const result of results) {
    mockLatencyById.set(result.id, result)
  }

  return results
}

function updateMockLatencyJob(body: unknown) {
  const queuedAt = new Date().toISOString()
  const items = updateMockLatencies(body)
  mockLatencyJob = {
    id: mockNextLatencyJobID++,
    status: 'finished',
    total: items.length,
    completed: items.length,
    succeeded: items.filter((item) => item.alive).length,
    failed: items.filter((item) => !item.alive).length,
    queuedAt,
    startedAt: queuedAt,
    finishedAt: new Date().toISOString(),
    message: 'mock manual latency probe finished',
  }
  return { items, job: mockLatencyJob }
}

export { isMockMode, MOCK_DEFAULT_IDS }
