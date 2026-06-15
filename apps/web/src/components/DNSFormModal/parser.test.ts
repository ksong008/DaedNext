import { describe, expect, it } from 'vitest'

import { generateDNSConfig, parseDNSConfig } from './parser'

describe('dns form parser', () => {
  it('roundtrips encrypted upstreams and resident response routing matchers', () => {
    const parsed = parseDNSConfig(`
upstream {
  h3up: 'h3://dns.example/custom'
  doq: 'quic://dns.example'
  doh: 'https://dns.example/dns-query'
}
routing {
  request {
    qname(suffix:example.test) -> h3up
    fallback: doq
  }
  response {
    upstream(asis) -> doh
    ip(203.0.113.0/24) -> reject
    fallback: accept
  }
}
`)

    expect(parsed.upstreams.map(({ name, link }) => ({ name, link }))).toEqual([
      { name: 'h3up', link: 'h3://dns.example/custom' },
      { name: 'doq', link: 'quic://dns.example' },
      { name: 'doh', link: 'https://dns.example/dns-query' },
    ])
    expect(parsed.responseRules.map(({ matcher, target }) => ({ matcher, target }))).toEqual([
      { matcher: 'upstream(asis)', target: 'doh' },
      { matcher: 'ip(203.0.113.0/24)', target: 'reject' },
      { matcher: 'fallback', target: 'accept' },
    ])

    expect(generateDNSConfig(parsed)).toContain("h3up: 'h3://dns.example/custom'")
    expect(generateDNSConfig(parsed)).toContain('upstream(asis) -> doh')
    expect(generateDNSConfig(parsed)).toContain('ip(203.0.113.0/24) -> reject')
    expect(generateDNSConfig(parsed)).toContain('fallback: accept')
  })
})
