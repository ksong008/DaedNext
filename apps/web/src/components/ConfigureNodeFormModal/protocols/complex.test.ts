import { afterEach, describe, expect, it, vi } from 'vitest'

describe('manual node protocol registry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps Hysteria2 port hopping when generating registry links', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { hysteria2Protocol } = await import('./complex')
    const link = hysteria2Protocol.generateLink({
      ...hysteria2Protocol.defaultValues,
      server: 'example.com',
      port: 443,
      auth: 'secret',
      ports: '10000-20000,443',
      pinSHA256: 'abcd',
    })

    expect(link).toContain('@example.com:10000-20000,443')
    expect(link).not.toContain('ports=')
  })

  it('generates Hysteria2 salamander obfs settings', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { hysteria2Protocol } = await import('./complex')
    const link = hysteria2Protocol.generateLink({
      ...hysteria2Protocol.defaultValues,
      server: 'example.com',
      port: 443,
      auth: 'secret',
      obfs: 'salamander',
      obfsPassword: 'obfs-secret',
      pinSHA256: 'abcd',
    })
    const parsed = new URL(link)

    expect(parsed.searchParams.get('obfs')).toBe('salamander')
    expect(parsed.searchParams.get('obfs-password')).toBe('obfs-secret')
  })

  it('generates resident Trojan-Go grpc settings', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { trojanProtocol } = await import('./complex')
    const link = trojanProtocol.generateLink({
      ...trojanProtocol.defaultValues,
      server: 'example.com',
      port: 443,
      password: 'secret',
      obfs: 'grpc',
      path: 'GunService',
      host: 'front.example',
      allowInsecure: true,
      alpn: 'h2',
    })
    const parsed = new URL(link)

    expect(parsed.protocol).toBe('trojan-go:')
    expect(parsed.searchParams.get('type')).toBe('grpc')
    expect(parsed.searchParams.get('serviceName')).toBe('GunService')
    expect(parsed.searchParams.get('host')).toBe('front.example')
    expect(parsed.searchParams.get('allowInsecure')).toBe('true')
    expect(parsed.searchParams.get('alpn')).toBe('h2')
  })

  it('generates resident VLESS meek and mux settings', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { v2rayProtocol } = await import('./complex')
    const meekLink = v2rayProtocol.generateLink({
      ...v2rayProtocol.defaultValues,
      protocol: 'vless',
      id: 'uuid',
      add: 'example.com',
      port: 443,
      net: 'meek',
      tls: 'tls',
      path: 'https://front.example/meek',
    })
    const muxLink = v2rayProtocol.generateLink({
      ...v2rayProtocol.defaultValues,
      protocol: 'vless',
      id: 'uuid',
      add: 'example.com',
      port: 443,
      net: 'tcp',
      tls: 'tls',
      mux: true,
    })

    expect(new URL(meekLink).searchParams.get('url')).toBe('https://front.example/meek')
    expect(new URL(muxLink).searchParams.get('mux')).toBe('1')
  })

  it('generates resident VLESS and VMess h2 settings with official http transport names', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { v2rayProtocol } = await import('./complex')
    const vlessLink = v2rayProtocol.generateLink({
      ...v2rayProtocol.defaultValues,
      protocol: 'vless',
      id: 'uuid',
      add: 'example.com',
      port: 443,
      net: 'h2',
      tls: 'tls',
      host: 'front.example',
      path: '/h2',
    })
    const vmessLink = v2rayProtocol.generateLink({
      ...v2rayProtocol.defaultValues,
      protocol: 'vmess',
      id: 'uuid',
      add: 'example.com',
      port: 443,
      net: 'h2',
      tls: 'tls',
      host: 'front.example',
      path: '/h2',
    })
    const vmessBody = JSON.parse(atob(vmessLink.slice('vmess://'.length)))

    expect(new URL(vlessLink).searchParams.get('type')).toBe('http')
    expect(new URL(vlessLink).searchParams.get('host')).toBe('front.example')
    expect(new URL(vlessLink).searchParams.get('path')).toBe('/h2')
    expect(vmessBody.net).toBe('http')
    expect(vmessBody.host).toBe('front.example')
    expect(vmessBody.path).toBe('/h2')
  })

  it('generates resident HTTPS proxy advanced settings', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { httpProtocol } = await import('./simple')
    const link = httpProtocol.generateLink({
      ...httpProtocol.defaultValues,
      protocol: 'https',
      host: 'proxy.example',
      port: 443,
      name: 'https-proxy',
      sni: 'sni.example',
      allowInsecure: true,
      transport: true,
      transportHost: 'front.example',
      transportPath: '/transport',
      tlsImplementation: 'utls',
      alpn: 'h2,http/1.1',
      utlsImitate: 'chrome',
    })
    const parsed = new URL(link)

    expect(parsed.pathname).toBe('/transport')
    expect(parsed.searchParams.get('transport')).toBe('true')
    expect(parsed.searchParams.get('host')).toBe('front.example')
    expect(parsed.searchParams.get('sni')).toBe('sni.example')
    expect(parsed.searchParams.get('allowInsecure')).toBe('true')
    expect(parsed.searchParams.get('tlsImplementation')).toBe('utls')
    expect(parsed.searchParams.get('alpn')).toBe('h2,http/1.1')
    expect(parsed.searchParams.get('utlsImitate')).toBe('chrome')
  })
})
