import type { APIClientInterface, APIQueryValue } from '~/apis/client'

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

const absoluteOriginPattern = /^https?:\/\/[^/]+/
const groupIDPattern = /^group-(\d+)$/
const nodeIDPattern = /^node-(\d+)$/
const subscriptionIDPattern = /^sub-(\d+)$/
const subscriptionNodeIDPattern = /^sub(\d+)-node-(\d+)$/
const groupNodesPathPattern = /^\/groups\/([^/]+)\/nodes$/
const groupSubscriptionsPathPattern = /^\/groups\/([^/]+)\/subscriptions$/
const numericIDPattern = /(\d+)/

const mockStorage = new Map<string, string>([
  ['mode', 'rule'],
  ['defaultConfigID', MOCK_DEFAULT_IDS.defaultConfigID],
  ['defaultRoutingID', MOCK_DEFAULT_IDS.defaultRoutingID],
  ['defaultDNSID', MOCK_DEFAULT_IDS.defaultDNSID],
  ['defaultGroupID', MOCK_DEFAULT_IDS.defaultGroupID],
])

const mockLatencyById = new Map<string, MockLatencyResult>()
let mockRuntimeLogLevel = 'info'
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

export class MockAPIClient implements APIClientInterface {
  constructor(private readonly endpoint: string) {}

  get<T>(path: string, query?: QueryRecord): Promise<T> {
    return this.handle<T>('GET', path, undefined, query)
  }

  post<T>(path: string, body?: unknown, query?: QueryRecord): Promise<T> {
    return this.handle<T>('POST', path, body, query)
  }

  put<T>(path: string, body?: unknown, query?: QueryRecord): Promise<T> {
    return this.handle<T>('PUT', path, body, query)
  }

  patch<T>(path: string, body?: unknown, query?: QueryRecord): Promise<T> {
    return this.handle<T>('PATCH', path, body, query)
  }

  delete<T>(path: string, body?: unknown, query?: QueryRecord): Promise<T> {
    return this.handle<T>('DELETE', path, body, query)
  }

  private async handle<T>(method: string, rawPath: string, body?: unknown, query?: QueryRecord): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 20))

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
        return mockGeneral.general.dae as T
      case 'GET /general/interfaces':
        return {
          items: mockGeneral.general.interfaces.map((iface) => ({
            name: iface.name,
            index: iface.index,
            up: iface.up,
            addresses: iface.addresses,
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
      case 'GET /nodes/latencies':
        return { items: Array.from(mockLatencyById.values()) } as T
      case 'POST /nodes/latencies':
        return { items: updateMockLatencies(body) } as T
      case 'GET /nodes':
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
        return {
          items: mockGroups.groups.map((group) => ({
            id: numericID(group.id),
            name: group.name,
            policy: group.policy,
            policyParams: group.policyParams,
            nodes: group.nodes.map((node) => toMockNodeAPI(node)),
            subscriptions: group.subscriptions.map((binding) => ({
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
        return {
          items: mockRoutings.routings.map((routing) => ({
            id: numericID(routing.id),
            name: routing.name,
            selected: routing.selected,
            parsedRouting: routing.routing,
          })),
        } as T
      case 'GET /dns':
        return {
          items: mockDNSs.dnss.map((dns) => ({
            id: numericID(dns.id),
            name: dns.name,
            selected: dns.selected,
            parsedDns: dns.dns,
          })),
        } as T
      case 'GET /configs':
        return {
          items: mockConfigs.configs.map((config) => ({
            id: numericID(config.id),
            name: config.name,
            global: 'global {}',
            selected: config.selected,
            parsedGlobal: config.global,
          })),
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
          global: 'global {}',
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
      } as T
    }

    if (method === 'GET' && path === '/user/me/dae-config-file') {
      return {
        filename: 'mock.dae',
        content: `global {\n  log_level: "info"\n}\n\ndns {\n  upstream {\n    googledns: "udp://8.8.8.8:53"\n  }\n  routing {\n    request {\n      fallback: "googledns"\n    }\n  }\n}\n\nrouting {\n  fallback: "proxy"\n}\n`,
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
    for (const binding of group.subscriptions) {
      for (const node of binding.matchedNodes) {
        addID(node.id)
      }
    }
  }

  return Array.from(ids)
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

  let regex: RegExp | null = null
  if (nameFilterRegex) {
    regex = new RegExp(nameFilterRegex)
  }

  let updated = 0
  const existingSubscriptionIDs = new Set(group.subscriptions.map((binding) => numericID(binding.subscription.id)))

  for (const subscriptionID of subscriptionIDs) {
    if (existingSubscriptionIDs.has(subscriptionID)) continue

    const subscription = mockSubscriptions.subscriptions.find((item) => numericID(item.id) === subscriptionID)
    if (!subscription) continue

    const matchedNodes = subscription.nodes.items
      .filter((node) => !regex || regex.test(node.name))
      .map((node) => ({
        ...node,
        address: '',
        tag: null,
        subscriptionID: subscription.id,
      }))

    group.subscriptions.push({
      matchedCount: matchedNodes.length,
      nameFilterRegex,
      subscription: {
        id: subscription.id,
        updatedAt: subscription.updatedAt,
        tag: subscription.tag,
        link: subscription.link,
        status: subscription.status,
        info: subscription.info,
      },
      matchedNodes,
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

export { isMockMode, MOCK_DEFAULT_IDS }
