export interface Upstream {
  id: string
  name: string
  link: string
}

export interface RoutingRule {
  id: string
  matcher: string
  target: string
}

export interface DNSPreservedLines {
  upstream: string[]
  routing: string[]
  request: string[]
  response: string[]
}

export interface DNSConfig {
  upstreams: Upstream[]
  requestRules: RoutingRule[]
  responseRules: RoutingRule[]
  others: string // Stores content that cannot be structured, e.g. global settings or comments
  wrappedInDNSBlock: boolean
  preserved: DNSPreservedLines
}
