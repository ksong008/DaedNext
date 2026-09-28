import { describe, expect, it } from 'vitest'

import { generateHysteria2URL, generateMasqueURL } from '../src/generator'
import { parseHysteria2Url, parseMasqueUrl } from '../src/parser'

describe('generateHysteria2URL', () => {
  it.each([false, 0, '0'])('preserves the explicit secure override %s', (insecure) => {
    const link = generateHysteria2URL({
      protocol: 'hysteria2',
      auth: 'secret',
      host: 'example.com',
      port: 443,
      params: { insecure },
    })
    expect(new URL(link).searchParams.has('insecure')).toBe(true)
    expect(parseHysteria2Url(link)?.allowInsecure).toBe(false)
  })
})

const common = {
  name: 'edge node',
  host: 'proxy.example',
  port: 8443,
  targetTemplate: '/.well-known/masque/udp/{target_host}/{target_port}/',
  sni: 'edge.example',
  allowInsecure: false,
} as const

describe('generateMasqueURL', () => {
  it('round-trips H2 basic authentication and escaped credentials', () => {
    const link = generateMasqueURL({
      ...common,
      transport: 'h2',
      authentication: 'basic',
      username: 'identity@example',
      password: 'p@ss/word',
    })

    expect(link).not.toContain('alpn=')
    expect(parseMasqueUrl(link)).toEqual({
      ...common,
      transport: 'h2',
      authentication: 'basic',
      username: 'identity@example',
      password: 'p@ss/word',
    })
  })

  it('round-trips H3 no-auth with an IPv6 authority', () => {
    const link = generateMasqueURL({
      ...common,
      host: '2001:db8::1',
      transport: 'h3',
      authentication: 'none',
      username: '',
      password: '',
    })

    expect(link).toContain('masque://[2001:db8::1]:8443?')
    expect(parseMasqueUrl(link)).toMatchObject({
      host: '2001:db8::1',
      transport: 'h3',
      authentication: 'none',
    })
  })
})
