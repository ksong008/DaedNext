import type { APIClientInterface, APIQueryValue } from '~/apis/client'

import {
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

const absoluteOriginPattern = /^https?:\/\/[^/]+/
const numericIDPattern = /(\d+)/

const mockStorage = new Map<string, string>([
  ['mode', 'rule'],
  ['defaultConfigID', MOCK_DEFAULT_IDS.defaultConfigID],
  ['defaultRoutingID', MOCK_DEFAULT_IDS.defaultRoutingID],
  ['defaultDNSID', MOCK_DEFAULT_IDS.defaultDNSID],
  ['defaultGroupID', MOCK_DEFAULT_IDS.defaultGroupID],
])

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
        return {
          updatedAt: new Date().toISOString(),
          uploadRate: '0',
          downloadRate: '0',
          uploadTotal: '0',
          downloadTotal: '0',
          activeConnections: 0,
          udpSessions: 0,
          rssBytes: '0',
          heapAllocBytes: '0',
          goroutines: 0,
          samples: [],
        } as T
      case 'GET /nodes/latencies':
      case 'POST /nodes/latencies':
        return { items: [] } as T
      case 'GET /nodes':
        return {
          items: mockNodes.nodes.items,
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
          })),
        } as T
      case 'GET /groups':
        return {
          items: mockGroups.groups.map((group) => ({
            id: numericID(group.id),
            name: group.name,
            policy: group.policy,
            policyParams: group.policyParams,
            nodes: group.nodes.map((node) => ({
              id: numericID(node.id),
              link: node.link,
              name: node.name,
              address: node.address,
              protocol: node.protocol,
              tag: node.tag,
              subscriptionId: node.subscriptionID ? numericID(node.subscriptionID) : null,
            })),
            subscriptions: group.subscriptions.map((binding) => ({
              subscriptionId: numericID(binding.subscription.id),
              nameFilterRegex: binding.nameFilterRegex,
              matchedCount: binding.matchedCount,
              matchedNodes: binding.matchedNodes.map((node) => ({
                id: numericID(node.id),
                link: node.link,
                name: node.name,
                address: node.address,
                protocol: node.protocol,
                tag: node.tag,
                subscriptionId: node.subscriptionID ? numericID(node.subscriptionID) : null,
              })),
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
      const subscription = mockSubscriptions.subscriptions.find((item) => item.id === id)
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

function numericID(value: string | number): number {
  const match = String(value).match(numericIDPattern)
  return match ? Number.parseInt(match[1], 10) : 0
}

function optionalNumericID(value?: string | number | null): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = numericID(value)
  return parsed > 0 ? parsed : undefined
}

export { isMockMode, MOCK_DEFAULT_IDS }
