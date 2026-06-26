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
  useProxy?: boolean
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

export interface SectionSummaryResource {
  id: string
  name: string
  selected: boolean
  version: number
  parseStatus?: string | null
  parseError?: string | null
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
  useProxy: boolean
  nodeCount: number
  nodes: NodeCollection
}

export interface SubscriptionSummaryResource {
  id: string
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

export interface GroupSummarySubscriptionResource {
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
  sampleMatchedNodes: NodeResource[]
}

export interface GroupSummaryResource {
  id: string
  name: string
  policy: Policy
  policyParams: PolicyParam[]
  version: number
  nodeCount: number
  subscriptionCount: number
  firstNode?: NodeResource | null
  subscriptions: GroupSummarySubscriptionResource[]
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

export type GeodataKind = 'geosite' | 'geoip'

export interface GeodataResource {
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

export interface GeodataView {
  geosite: GeodataResource
  geoip: GeodataResource
  updated?: GeodataKind
  runtimeReloadRequired?: boolean
  runtimeReloaded?: boolean
  runtimeReloadSource?: string
  runtimeReloadElapsed?: string
  runtimeReloadStatus?: unknown
  runtimeReloadMessage?: string
}

export interface GeodataSourceResource {
  kind: GeodataKind
  url: string
  defaultUrl: string
  usingDefault: boolean
}

export interface GeodataSettingsView {
  geosite: GeodataSourceResource
  geoip: GeodataSourceResource
}

export interface GeodataUpdateResult {
  geosite?: GeodataResource
  geoip?: GeodataResource
  updated: GeodataKind
  runtimeReloadRequired?: boolean
  runtimeReloaded?: boolean
  runtimeReloadSource?: string
  runtimeReloadElapsed?: string
  runtimeReloadStatus?: unknown
  runtimeReloadMessage?: string
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
  useProxy: boolean
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

export interface GeneralResourceCounts {
  configs: number
  dns: number
  routings: number
  groups: number
  nodes: number
  subscriptions: number
  logs: number
}

export interface GeneralDaemonState {
  running: boolean
  modified: boolean
  version: string
  netnsLinkMode?: string
  attachBackend?: string
}

export interface GeneralStateView {
  general: {
    dae: GeneralDaemonState
    counts: GeneralResourceCounts
    interfaces: InterfaceResource[]
  }
}

export interface RuntimeOverviewRuntimeState {
  running?: boolean
  state?: string
  attachBackend?: string | null
  netnsLinkMode?: string | null
  fakeRuntime?: boolean
  residentRuntimeStarted?: boolean
  startedAt?: string | null
  lastTransitionAt?: string | null
  reloadCount?: number
  stopCount?: number
  startupEvidence?: {
    cgroupPname?: {
      source?: string | null
      semantics?: string | null
      coreStatus?: string | null
      coreEnabled?: boolean
      currentTaskArgvEnabled?: boolean
      nonCoreTaskCommEnabled?: boolean
    } | null
  } | null
  residentDataplane?: {
    metrics?: {
      resources?: {
        manualProbe?: {
          concurrency?: {
            value?: number
            source?: string
            default?: number
            min?: number
            max?: number
          }
        }
      }
    }
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
  cpuUsagePercent: number
  rssBytes: string
  heapLiveBytes: string
  goroutines: number
  runtime?: RuntimeOverviewRuntimeState
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

export interface NodeLatencyJob {
  id: string
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

export interface NodeLatencyJobView {
  job: NodeLatencyJob | null
}

export interface NodeLatencyProbeResponse {
  items: NodeLatencyProbeResult[]
  job?: NodeLatencyJob | null
}

export interface LogEntry {
  id: number
  ts: string
  level: string
  message: string
  fields?: Record<string, string>
}

export interface LogSettings {
  maxEntries: number
  maxBytes: number
  minMaxEntries: number
  maxMaxEntries: number
  minMaxBytes: number
  maxMaxBytes: number
}

export interface ConfigListView {
  configs: ConfigResource[]
}

export interface ConfigSummaryListView {
  configs: SectionSummaryResource[]
}

export interface GroupListView {
  groups: GroupResource[]
}

export interface GroupSummaryListView {
  groups: GroupSummaryResource[]
}

export interface NodeListView {
  nodes: NodeCollection
}

export interface SubscriptionListView {
  subscriptions: SubscriptionResource[]
}

export interface SubscriptionSummaryListView {
  subscriptions: SubscriptionSummaryResource[]
}

export interface RoutingListView {
  routings: RoutingResource[]
}

export interface RoutingSummaryListView {
  routings: SectionSummaryResource[]
}

export interface DNSListView {
  dnss: DNSResource[]
}

export interface DNSSummaryListView {
  dnss: SectionSummaryResource[]
}

export interface CurrentUserView {
  user: UserResource
}
