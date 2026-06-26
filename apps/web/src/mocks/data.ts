/**
 * Mock data for e2e testing and screenshots
 * This file provides realistic mock data for the REST/OpenAPI-backed UI flows
 *
 * Usage:
 *   1. Set VITE_MOCK_MODE=true in .env or run: pnpm dev:mock
 *   2. The app will use mock data instead of real API calls
 */

import type {
  ConfigListView,
  CurrentUserView,
  DNSListView,
  GeneralStateView,
  GroupListView,
  NodeListView,
  RoutingListView,
  SubscriptionListView,
} from '~/apis/types'
import { Policy } from '~/apis/types'

// Check if mock mode is enabled
export const isMockMode = () => import.meta.env.VITE_MOCK_MODE === 'true'

// Default IDs for resources
export const MOCK_DEFAULT_IDS = {
  defaultConfigID: 'config-1',
  defaultRoutingID: 'routing-1',
  defaultDNSID: 'dns-1',
  defaultGroupID: 'group-1',
}

// General/System info
export const mockGeneral: GeneralStateView = {
  general: {
    dae: {
      running: true,
      modified: false,
      version: 'v0.8.0',
      netnsLinkMode: 'netkit',
      attachBackend: 'tcx',
    },
    counts: {
      configs: 0,
      dns: 0,
      routings: 0,
      groups: 0,
      nodes: 0,
      subscriptions: 0,
      logs: 0,
    },
    interfaces: [
      {
        name: 'eth0',
        index: 2,
        up: true,
        addresses: ['192.168.1.100/24', 'fe80::1/64'],
        defaultRoutes: [{ gateway: '192.168.1.1' }],
      },
      {
        name: 'wlan0',
        index: 3,
        up: true,
        addresses: ['192.168.1.101/24'],
        defaultRoutes: [],
      },
      {
        name: 'docker0',
        index: 4,
        up: true,
        addresses: ['172.17.0.1/16'],
        defaultRoutes: [],
      },
    ],
  },
} as any

interface MockRuntimeOverviewSample {
  timestamp: string
  uploadRate: string
  downloadRate: string
}

interface MockRuntimeOverviewResponse {
  updatedAt: string
  uploadRate: string
  downloadRate: string
  uploadTotal: string
  downloadTotal: string
  activeConnections: number
  udpSessions: number
  cpuUsagePercent: number
  rssBytes: string
  heapLiveBytes: string
  goroutines: number
  runtime: {
    running: boolean
    state: string
    attachBackend: string
    netnsLinkMode: string
    startedAt: string
    lastTransitionAt: string
    reloadCount: number
    stopCount: number
  }
  samples: MockRuntimeOverviewSample[]
}

const MOCK_UPLOAD_TOTAL_BYTES = Math.round(18.6 * 1024 ** 3)
const MOCK_DOWNLOAD_TOTAL_BYTES = Math.round(143.2 * 1024 ** 3)

function clampToInt(value: number) {
  return Math.max(0, Math.round(value))
}

function createMockRuntimeSamples(
  windowSec: number,
  pointCount: number,
  endMs = Date.now(),
): MockRuntimeOverviewSample[] {
  const safePointCount = Math.max(2, pointCount)
  const startMs = endMs - windowSec * 1000
  const stepMs = (windowSec * 1000) / (safePointCount - 1)

  return Array.from({ length: safePointCount }, (_, index) => {
    const progress = index / (safePointCount - 1)
    const timestamp = new Date(startMs + stepMs * index).toISOString()
    const trend = 0.42 + progress * 0.58
    const uploadWave = 0.18 * Math.sin(progress * Math.PI * 6)
    const uploadPulse = 0.07 * Math.sin(progress * Math.PI * 18)
    const downloadWave = 0.22 * Math.sin(progress * Math.PI * 6 + 0.75)
    const downloadPulse = 0.08 * Math.cos(progress * Math.PI * 14)

    const uploadRate = clampToInt((4.2 + 14.4 * trend + 5.6 * uploadWave + 2.2 * uploadPulse) * 1024 ** 2)
    const downloadRate = clampToInt((6.1 + 15.9 * trend + 6.4 * downloadWave + 2.6 * downloadPulse) * 1024 ** 2)

    return {
      timestamp,
      uploadRate: String(uploadRate),
      downloadRate: String(downloadRate),
    }
  })
}

export function getMockRuntimeOverview(windowSec = 60, maxPoints = 240): MockRuntimeOverviewResponse {
  const normalizedWindowSec = Math.max(1, windowSec)
  const normalizedPointCount = Math.max(2, maxPoints)
  const samples = createMockRuntimeSamples(normalizedWindowSec, normalizedPointCount)
  const updatedAt = samples.at(-1)?.timestamp || new Date().toISOString()
  const latestSample = samples.at(-1)

  return {
    updatedAt,
    uploadRate: latestSample?.uploadRate || '0',
    downloadRate: latestSample?.downloadRate || '0',
    uploadTotal: String(MOCK_UPLOAD_TOTAL_BYTES),
    downloadTotal: String(MOCK_DOWNLOAD_TOTAL_BYTES),
    activeConnections: 284,
    udpSessions: 37,
    cpuUsagePercent: 8.6,
    rssBytes: String(Math.round(96.2 * 1024 ** 2)),
    heapLiveBytes: String(Math.round(31.4 * 1024 ** 2)),
    goroutines: 42,
    runtime: {
      running: true,
      state: 'running',
      attachBackend: 'tcx',
      netnsLinkMode: 'netkit',
      startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000 - 48 * 60 * 1000).toISOString(),
      lastTransitionAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      reloadCount: 3,
      stopCount: 0,
    },
    samples,
  }
}

// Configs
export const mockConfigs: ConfigListView = {
  configs: [
    {
      id: 'config-1',
      name: 'default',
      selected: true,
      global: {
        logLevel: 'error',
        tproxyPort: 12345,
        allowInsecure: false,
        checkInterval: '30s',
        checkTolerance: '50ms',
        lanInterface: [],
        wanInterface: ['auto'],
        udpCheckDns: ['dns.google.com:53', '8.8.8.8', '2001:4860:4860::8888'],
        tcpCheckUrl: ['http://cp.cloudflare.com', '1.1.1.1', '2606:4700:4700::1111'],
        fallbackResolver: '',
        dialMode: 'domain',
        tcpCheckHttpMethod: 'HEAD',
        disableWaitingNetwork: false,
        autoConfigKernelParameter: true,
        sniffingTimeout: '100ms',
        tlsImplementation: 'tls',
        utlsImitate: 'chrome_auto',
        tproxyPortProtect: true,
        soMarkFromDae: 0,
        pprofPort: 0,
        enableLocalTcpFastRedirect: false,
        mptcp: false,
        bandwidthMaxTx: '',
        bandwidthMaxRx: '',
      },
    },
    {
      id: 'config-2',
      name: 'Gaming Config',
      selected: false,
      global: {
        logLevel: 'warn',
        tproxyPort: 12346,
        allowInsecure: false,
        checkInterval: '10s',
        checkTolerance: '30ms',
        lanInterface: ['eth0'],
        wanInterface: ['auto'],
        udpCheckDns: ['dns.google.com:53', '8.8.8.8'],
        tcpCheckUrl: ['http://cp.cloudflare.com', '1.1.1.1'],
        fallbackResolver: '8.8.8.8:53',
        dialMode: 'ip',
        tcpCheckHttpMethod: 'HEAD',
        disableWaitingNetwork: true,
        autoConfigKernelParameter: true,
        sniffingTimeout: '50ms',
        tlsImplementation: 'utls',
        utlsImitate: 'chrome_120',
        tproxyPortProtect: true,
        soMarkFromDae: 0,
        pprofPort: 0,
        enableLocalTcpFastRedirect: true,
        mptcp: false,
        bandwidthMaxTx: '100mbps',
        bandwidthMaxRx: '200mbps',
      },
    },
  ],
} as any

// Nodes
export const mockNodes: NodeListView = {
  nodes: {
    items: [
      {
        id: 'node-1',
        name: 'Tokyo-01',
        link: 'vmess://eyJhZGQiOiJ0b2t5by5leGFtcGxlLmNvbSIsInBzIjoiVG9reW8tMDEifQ==',
        address: 'tokyo.example.com:443',
        protocol: 'vmess',
        tag: 'JP-Tokyo-Premium',
      },
      {
        id: 'node-2',
        name: 'Singapore-02',
        link: 'trojan://password@sg.example.com:443',
        address: 'sg.example.com:443',
        protocol: 'trojan',
        tag: 'SG-Singapore-Standard',
      },
      {
        id: 'node-3',
        name: 'HongKong-03',
        link: 'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@hk.example.com:8388',
        address: 'hk.example.com:8388',
        protocol: 'shadowsocks',
        tag: 'HK-HongKong-IPLC',
      },
      {
        id: 'node-4',
        name: 'US-West-04',
        link: 'vless://uuid@us.example.com:443?type=ws',
        address: 'us.example.com:443',
        protocol: 'vless',
        tag: 'US-LosAngeles-BGP',
      },
    ],
  },
} as any

// Subscriptions
export const mockSubscriptions: SubscriptionListView = {
  subscriptions: [
    {
      id: 'sub-1',
      tag: 'Premium Provider',
      status: 'ok',
      link: 'https://example.com/api/v1/client/subscribe?token=xxxxx',
      info: 'upload=10737418240; download=53687091200; total=107374182400; expire=1735689600',
      updatedAt: '2024-11-28T10:30:00Z',
      cronExp: '0 0 * * *',
      cronEnable: true,
      useProxy: false,
      nodes: {
        items: [
          {
            id: 'sub1-node-1',
            name: 'Tokyo-Premium-01',
            protocol: 'vmess',
            link: 'vmess://xxxxx',
          },
          {
            id: 'sub1-node-2',
            name: 'Singapore-Premium-02',
            protocol: 'trojan',
            link: 'trojan://xxxxx',
          },
          {
            id: 'sub1-node-3',
            name: 'HongKong-Premium-03',
            protocol: 'shadowsocks',
            link: 'ss://xxxxx',
          },
          {
            id: 'sub1-node-4',
            name: 'US-Premium-04',
            protocol: 'vless',
            link: 'vless://xxxxx',
          },
          {
            id: 'sub1-node-5',
            name: 'Korea-Premium-05',
            protocol: 'hysteria2',
            link: 'hysteria2://xxxxx',
          },
        ],
      },
    },
    {
      id: 'sub-2',
      tag: 'Backup Provider',
      status: 'ok',
      link: 'https://backup.example.com/subscribe/token',
      info: 'upload=1073741824; download=5368709120; total=10737418240; expire=1738368000',
      updatedAt: '2024-11-27T15:45:00Z',
      cronExp: '0 12 * * 1',
      cronEnable: false,
      useProxy: true,
      nodes: {
        items: [
          {
            id: 'sub2-node-1',
            name: 'Japan-Backup-01',
            protocol: 'vmess',
            link: 'vmess://xxxxx',
          },
          {
            id: 'sub2-node-2',
            name: 'Taiwan-Backup-02',
            protocol: 'trojan',
            link: 'trojan://xxxxx',
          },
          {
            id: 'sub2-node-3',
            name: 'Germany-Backup-03',
            protocol: 'shadowsocks',
            link: 'ss://xxxxx',
          },
        ],
      },
    },
    {
      id: 'sub-3',
      tag: 'Regional Provider',
      status: 'ok',
      link: 'https://regional.example.com/subscribe/token',
      info: 'upload=2147483648; download=8589934592; total=17179869184; expire=1741046400',
      updatedAt: '2024-11-29T08:15:00Z',
      cronExp: '0 6 * * *',
      cronEnable: true,
      useProxy: false,
      nodes: {
        items: [
          {
            id: 'sub3-node-1',
            name: 'Regional-Standard-01',
            protocol: 'vless',
            link: 'vless://xxxxx',
          },
          {
            id: 'sub3-node-2',
            name: 'Regional-Standard-02',
            protocol: 'trojan',
            link: 'trojan://xxxxx',
          },
        ],
      },
    },
  ],
} as any

// Groups
export const mockGroups: GroupListView = {
  groups: [
    {
      id: 'group-1',
      name: 'default',
      policy: Policy.Random,
      policyParams: [],
      nodes: [
        {
          id: 'node-1',
          link: 'vmess://xxxxx',
          name: 'Tokyo-01',
          address: 'tokyo.example.com:443',
          protocol: 'vmess',
          tag: 'JP-Tokyo-Premium',
          subscriptionID: null,
        },
        {
          id: 'node-2',
          link: 'trojan://xxxxx',
          name: 'Singapore-02',
          address: 'sg.example.com:443',
          protocol: 'trojan',
          tag: 'SG-Singapore-Standard',
          subscriptionID: null,
        },
      ],
      subscriptions: [
        {
          matchedCount: 5,
          nameFilterRegex: 'Premium',
          subscription: {
            id: 'sub-1',
            updatedAt: '2024-11-28T10:30:00Z',
            tag: 'Premium Provider',
            link: 'https://example.com/api/v1/client/subscribe?token=xxxxx',
            status: 'ok',
            info: 'upload=10737418240; download=53687091200; total=107374182400; expire=1735689600',
          },
          matchedNodes: [
            {
              id: 'sub1-node-1',
              link: 'vmess://xxxxx',
              name: 'Tokyo-Premium-01',
              address: 'tokyo.example.com:443',
              protocol: 'vmess',
              tag: 'JP-Premium',
              subscriptionID: 'sub-1',
            },
            {
              id: 'sub1-node-2',
              link: 'trojan://xxxxx',
              name: 'Singapore-Premium-02',
              address: 'sg.example.com:443',
              protocol: 'trojan',
              tag: 'SG-Premium',
              subscriptionID: 'sub-1',
            },
            {
              id: 'sub1-node-3',
              link: 'ss://xxxxx',
              name: 'HongKong-Premium-03',
              address: 'hk.example.com:8388',
              protocol: 'shadowsocks',
              tag: 'HK-Premium',
              subscriptionID: 'sub-1',
            },
            {
              id: 'sub1-node-4',
              link: 'vless://xxxxx',
              name: 'US-Premium-04',
              address: 'us.example.com:443',
              protocol: 'vless',
              tag: 'US-Premium',
              subscriptionID: 'sub-1',
            },
            {
              id: 'sub1-node-5',
              link: 'hysteria2://xxxxx',
              name: 'Korea-Premium-05',
              address: 'kr.example.com:443',
              protocol: 'hysteria2',
              tag: 'KR-Premium',
              subscriptionID: 'sub-1',
            },
          ],
        },
      ],
    },
    {
      id: 'group-2',
      name: 'Gaming',
      policy: Policy.Min,
      policyParams: [],
      nodes: [
        {
          id: 'node-3',
          link: 'ss://xxxxx',
          name: 'HongKong-03',
          address: 'hk.example.com:8388',
          protocol: 'shadowsocks',
          tag: 'HK-HongKong-IPLC',
          subscriptionID: null,
        },
      ],
      subscriptions: [],
    },
    {
      id: 'group-3',
      name: 'Streaming',
      policy: Policy.Random,
      policyParams: [],
      nodes: [],
      subscriptions: [
        {
          matchedCount: 3,
          nameFilterRegex: null,
          subscription: {
            id: 'sub-2',
            updatedAt: '2024-11-27T15:45:00Z',
            tag: 'Backup Provider',
            link: 'https://backup.example.com/subscribe/token',
            status: 'ok',
            info: 'upload=1073741824; download=5368709120; total=10737418240; expire=1738368000',
          },
          matchedNodes: [
            {
              id: 'sub2-node-1',
              link: 'vmess://xxxxx',
              name: 'Japan-Backup-01',
              address: 'japan.example.com:443',
              protocol: 'vmess',
              tag: 'JP-Backup',
              subscriptionID: 'sub-2',
            },
            {
              id: 'sub2-node-2',
              link: 'trojan://xxxxx',
              name: 'Taiwan-Backup-02',
              address: 'taiwan.example.com:443',
              protocol: 'trojan',
              tag: 'TW-Backup',
              subscriptionID: 'sub-2',
            },
            {
              id: 'sub2-node-3',
              link: 'ss://xxxxx',
              name: 'Germany-Backup-03',
              address: 'de.example.com:8388',
              protocol: 'shadowsocks',
              tag: 'DE-Backup',
              subscriptionID: 'sub-2',
            },
          ],
        },
      ],
    },
  ],
} as any

// Routings
export const mockRoutings: RoutingListView = {
  routings: [
    {
      id: 'routing-1',
      name: 'default',
      selected: true,
      routing: {
        string: `# Default routing rules
pname(NetworkManager, systemd-resolved) -> must_direct
dip(geoip:private) -> direct
dip(geoip:cn) -> direct
domain(geosite:cn) -> direct
fallback: default`,
      },
    },
    {
      id: 'routing-2',
      name: 'Global Proxy',
      selected: false,
      routing: {
        string: `# Global proxy routing
pname(NetworkManager, systemd-resolved) -> must_direct
dip(geoip:private) -> direct
fallback: default`,
      },
    },
  ],
} as any

// DNS
export const mockDNSs: DNSListView = {
  dnss: [
    {
      id: 'dns-1',
      name: 'default',
      selected: true,
      dns: {
        string: `# Default DNS configuration
upstream {
  googledns: 'tcp+udp://dns.google.com:53'
  alidns: 'udp://dns.alidns.com:53'
}

routing {
  request {
    qname(geosite:cn) -> alidns
    fallback: googledns
  }
}`,
        routing: {
          request: {
            string: `qname(geosite:cn) -> alidns
fallback: googledns`,
          },
          response: {
            string: '',
          },
        },
      },
    },
    {
      id: 'dns-2',
      name: 'DoH Only',
      selected: false,
      dns: {
        string: `# DoH DNS configuration
upstream {
  cloudflare: 'https://cloudflare-dns.com/dns-query'
  google: 'https://dns.google/dns-query'
}

routing {
  request {
    fallback: cloudflare
  }
}`,
        routing: {
          request: {
            string: 'fallback: cloudflare',
          },
          response: {
            string: '',
          },
        },
      },
    },
  ],
}

// User
export const mockUser: CurrentUserView = {
  user: {
    username: 'admin',
    name: 'Administrator',
    avatar: '',
  },
} as any

// JSON Storage (defaults)
export const mockJsonStorage = {
  jsonStorage: [
    MOCK_DEFAULT_IDS.defaultConfigID,
    MOCK_DEFAULT_IDS.defaultRoutingID,
    MOCK_DEFAULT_IDS.defaultDNSID,
    MOCK_DEFAULT_IDS.defaultGroupID,
  ],
}

// Export all mocks as a single object for easy access
export const allMocks = {
  general: mockGeneral,
  configs: mockConfigs,
  nodes: mockNodes,
  subscriptions: mockSubscriptions,
  groups: mockGroups,
  routings: mockRoutings,
  dnss: mockDNSs,
  user: mockUser,
  jsonStorage: mockJsonStorage,
  defaultIds: MOCK_DEFAULT_IDS,
}
