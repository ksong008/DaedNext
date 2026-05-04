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

export interface NodeCollection {
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
  nodes: NodeCollection
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
  rawGlobal: string
  parseError?: string | null
}

export interface ConfigPreviewResult {
  global: string
  parsedGlobal: ConfigGlobal
}

export interface DAEBundleDefaults {
  configId?: number
  dnsId?: number
  routingId?: number
  groupId?: number
}

export interface DAEBundleSelected {
  configId?: number
  dnsId?: number
  routingId?: number
}

export interface DAEBundleConfig {
  id: number
  name: string
  global: string
}

export interface DAEBundleDNS {
  id: number
  name: string
  dns: string
}

export interface DAEBundleRouting {
  id: number
  name: string
  routing: string
}

export interface DAEBundleSubscription {
  id: number
  updatedAt: string
  link: string
  cronExp: string
  cronEnable: boolean
  status: string
  info: string
  tag?: string | null
}

export interface DAEBundleNode {
  id: number
  link: string
  name: string
  address: string
  protocol: string
  tag?: string | null
  subscriptionId?: number | null
}

export interface DAEBundleGroupSubscription {
  subscriptionId: number
  nameFilterRegex?: string | null
}

export interface DAEBundleGroup {
  id: number
  name: string
  policy: Policy
  policyParams: PolicyParam[]
  nodeIds: number[]
  subscriptionBindings: DAEBundleGroupSubscription[]
}

export interface DAEBundle {
  schemaVersion: number
  exportedAt: string
  mode: string
  defaults: DAEBundleDefaults
  selected: DAEBundleSelected
  configs: DAEBundleConfig[]
  dnss: DAEBundleDNS[]
  routings: DAEBundleRouting[]
  subscriptions: DAEBundleSubscription[]
  nodes: DAEBundleNode[]
  groups: DAEBundleGroup[]
}

export interface DAEConfigFileExportResult {
  filename: string
  content: string
  warnings?: DAEConfigFileIssue[]
}

export interface DAEConfigFileImportResult {
  imported: boolean
  warnings?: DAEConfigFileIssue[]
}

export interface DAEConfigFilePreviewResult {
  bundle: DAEBundle
  warnings?: DAEConfigFileIssue[]
}

export type DAEConfigFileIssueLevel = 'info' | 'warn' | 'lossy'

export interface DAEConfigFileIssue {
  level: DAEConfigFileIssueLevel
  code: string
  message: string
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

export interface GeneralStateView {
  general: {
    dae: {
      running: boolean
      modified: boolean
      version: string
    }
    interfaces: InterfaceResource[]
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

export interface ConfigListView {
  configs: ConfigResource[]
}

export interface GroupListView {
  groups: GroupResource[]
}

export interface NodeListView {
  nodes: NodeCollection
}

export interface SubscriptionListView {
  subscriptions: SubscriptionResource[]
}

export interface RoutingListView {
  routings: RoutingResource[]
}

export interface DNSListView {
  dnss: DNSResource[]
}

export interface CurrentUserView {
  user: UserResource
}
