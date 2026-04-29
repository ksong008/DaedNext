export enum Policy {
  Random = 'random',
  Fixed = 'fixed',
  MinAvg10 = 'min_avg10',
  MinMovingAvg = 'min_moving_avg',
  Min = 'min',
}

export interface PolicyParam {
  key?: string | null
  val: string
}

export interface ImportArgument {
  link: string
  tag?: string | null
}

export interface GlobalInput {
  logLevel?: string
  tproxyPort?: number
  tproxyPortProtect?: boolean
  pprofPort?: number
  soMarkFromDae?: number
  allowInsecure?: boolean
  checkInterval?: string
  checkTolerance?: string
  sniffingTimeout?: string
  lanInterface?: string[]
  wanInterface?: string[]
  udpCheckDns?: string[]
  tcpCheckUrl?: string[]
  dialMode?: string
  tcpCheckHttpMethod?: string
  disableWaitingNetwork?: boolean
  autoConfigKernelParameter?: boolean
  tlsImplementation?: string
  utlsImitate?: string
  fallbackResolver?: string
  mptcp?: boolean
  enableLocalTcpFastRedirect?: boolean
  bandwidthMaxTx?: string
  bandwidthMaxRx?: string
}

export interface NodeResource {
  id: string
  link: string
  name: string
  address: string
  protocol: string
  transport?: string | null
  tag?: string | null
  subscriptionID?: string | null
}

export interface NodesConnection {
  totalCount: number
  items: NodeResource[]
}

export interface SubscriptionResource {
  id: string
  tag?: string | null
  status: string
  link: string
  info: string
  updatedAt: string
  cronExp: string
  cronEnable: boolean
  nodes: NodesConnection
}

export interface GroupSubscriptionResource {
  nameFilterRegex?: string | null
  matchedCount: number
  subscription: {
    id: string
    updatedAt: string
    tag?: string | null
    link: string
    status: string
    info: string
  }
  matchedNodes: NodeResource[]
}

export interface GroupResource {
  id: string
  name: string
  nodes: NodeResource[]
  subscriptions: GroupSubscriptionResource[]
  policy: Policy
  policyParams: PolicyParam[]
}

export interface ConfigGlobal {
  logLevel: string
  tproxyPort: number
  allowInsecure: boolean
  checkInterval: string
  checkTolerance: string
  lanInterface: string[]
  wanInterface: string[]
  udpCheckDns: string[]
  tcpCheckUrl: string[]
  fallbackResolver: string
  dialMode: string
  tcpCheckHttpMethod: string
  disableWaitingNetwork: boolean
  autoConfigKernelParameter: boolean
  sniffingTimeout: string
  tlsImplementation: string
  utlsImitate: string
  tproxyPortProtect: boolean
  soMarkFromDae: number
  pprofPort: number
  enableLocalTcpFastRedirect: boolean
  mptcp: boolean
  bandwidthMaxTx: string
  bandwidthMaxRx: string
}

export interface ConfigResource {
  id: string
  name: string
  selected: boolean
  global: ConfigGlobal
}

export interface RoutingView {
  string: string
}

export interface DNSView {
  string: string
  routing: {
    request: RoutingView
    response: RoutingView
  }
}

export interface RoutingResource {
  id: string
  name: string
  selected: boolean
  routing: RoutingView
}

export interface DNSResource {
  id: string
  name: string
  selected: boolean
  dns: DNSView
}

export interface UserResource {
  username: string
  name?: string | null
  avatar?: string | null
}

export interface InterfaceResource {
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

export interface GeneralQuery {
  general: {
    dae: {
      running: boolean
      modified: boolean
      version: string
    }
    interfaces: InterfaceResource[]
    schema?: Record<string, unknown>
  }
}

export interface TrafficOverviewQueryData {
  updatedAt: string
  uploadRate: number
  downloadRate: number
  uploadTotal: string
  downloadTotal: string
  activeConnections: number
  udpSessions: number
  rssBytes: string
  heapAllocBytes: string
  goroutines: number
  samples: Array<{
    timestamp: string
    uploadRate: number
    downloadRate: number
  }>
}

export interface NodeLatencyProbeResult {
  id: string
  latencyMs?: number | null
  alive: boolean
  testedAt: string
  message?: string | null
}

export interface ConfigsQuery {
  configs: ConfigResource[]
}

export interface GroupsQuery {
  groups: GroupResource[]
}

export interface NodesQuery {
  nodes: NodesConnection
}

export interface SubscriptionsQuery {
  subscriptions: SubscriptionResource[]
}

export interface RoutingsQuery {
  routings: RoutingResource[]
}

export interface DNSsQuery {
  dnss: DNSResource[]
}

export interface UserQuery {
  user: UserResource
}
