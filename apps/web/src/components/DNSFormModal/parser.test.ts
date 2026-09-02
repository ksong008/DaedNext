import { describe, expect, it } from 'vitest'

import { generateDNSConfig, parseDNSConfig } from './parser'

describe('dns form parser', () => {
  it('preserves an outer dns block when switching through simple mode', () => {
    const parsed = parseDNSConfig(`
dns {
  upstream {
    local: 'udp://127.0.0.1:53'
  }
}
`)

    expect(parsed.wrappedInDNSBlock).toBe(true)
    expect(generateDNSConfig(parsed)).toContain('dns {\nupstream {')
    expect(parseDNSConfig(generateDNSConfig(parsed)).wrappedInDNSBlock).toBe(true)
  })

  it('keeps a plain config unwrapped', () => {
    const parsed = parseDNSConfig("upstream { local: 'udp://127.0.0.1:53' }")

    expect(parsed.wrappedInDNSBlock).toBe(false)
    expect(generateDNSConfig(parsed)).not.toMatch(/^dns\s*\{/)
  })

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

  it('preserves comments and unknown lines in their original DNS blocks', () => {
    const parsed = parseDNSConfig(`
# outer comment
upstream {
  # upstream comment
  doh: 'https://resolver.example/dns-query#fragment' # keep upstream note
  include_upstreams('private.dae')
}
routing {
  # routing comment
  strategy: strict
  request {
    # request comment
    qname(suffix:example.test) -> doh # keep request note
    custom_request_directive()
  }
  response {
    # response comment
    ip(203.0.113.0/24) -> accept # keep response note
    custom_response_directive()
  }
}
`)

    expect(parsed.upstreams[0].link).toBe('https://resolver.example/dns-query#fragment')
    expect(parsed.requestRules[0].target).toBe('doh')
    expect(parsed.responseRules[0].target).toBe('accept')
    expect(parsed.preserved).toEqual({
      upstream: ['# upstream comment', '# keep upstream note', "include_upstreams('private.dae')"],
      routing: ['# routing comment', 'strategy: strict'],
      request: ['# request comment', '# keep request note', 'custom_request_directive()'],
      response: ['# response comment', '# keep response note', 'custom_response_directive()'],
    })

    const generated = generateDNSConfig(parsed)
    expect(generated).toContain('# outer comment')
    expect(generated).toContain("doh: 'https://resolver.example/dns-query#fragment'")
    expect(generated).toContain('  strategy: strict')
    expect(generated).toContain('    custom_request_directive()')
    expect(generated).toContain('    custom_response_directive()')
    expect(parseDNSConfig(generated).preserved).toEqual(parsed.preserved)
  })
})
