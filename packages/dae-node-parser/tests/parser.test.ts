import { describe, expect, it } from 'vitest'

import {
  parseHTTPUrl,
  parseHysteria2Url,
  parseMasqueUrl,
  parseNodeUrl,
  parseSocks5Url,
  parseSSUrl,
  parseTrojanUrl,
  parseV2rayUrl,
} from '../src/parser'

const masqueTemplate = '%2F.well-known%2Fmasque%2Fudp%2F%7Btarget_host%7D%2F%7Btarget_port%7D%2F'

describe('parseHTTPUrl', () => {
  it('should parse basic HTTP URL', () => {
    const result = parseHTTPUrl('http://example.com:8080#my-proxy')
    expect(result).toEqual({
      protocol: 'http',
      host: 'example.com',
      port: 8080,
      username: '',
      password: '',
      name: 'my-proxy',
      sni: '',
      allowInsecure: false,
      transport: false,
      transportHost: '',
      transportPath: '',
      tlsImplementation: 'tls',
      alpn: '',
      utlsImitate: '',
    })
  })

  it('should parse HTTPS URL with auth', () => {
    const result = parseHTTPUrl(
      'https://user:pass@example.com:443/tunnel?sni=sni.example&allowInsecure=1&transport=true&host=front.example&tlsImplementation=utls&utlsImitate=chrome&alpn=h2%2Chttp%2F1.1#proxy',
    )
    expect(result).toEqual({
      protocol: 'https',
      host: 'example.com',
      port: 443,
      username: 'user',
      password: 'pass',
      name: 'proxy',
      sni: 'sni.example',
      allowInsecure: true,
      transport: true,
      transportHost: 'front.example',
      transportPath: '/tunnel',
      tlsImplementation: 'utls',
      alpn: 'h2,http/1.1',
      utlsImitate: 'chrome',
    })
  })

  it('should return null for non-HTTP URL', () => {
    expect(parseHTTPUrl('socks5://example.com')).toBeNull()
  })
})

describe('parseMasqueUrl', () => {
  it('parses an explicit H2 basic-auth source without inferring ALPN', () => {
    expect(
      parseMasqueUrl(
        `masque://identity:p%40ss@proxy.example:8443?transport=h2&auth=basic&template=${masqueTemplate}&sni=edge.example&allowInsecure=1#edge%20h2`,
      ),
    ).toEqual({
      name: 'edge h2',
      host: 'proxy.example',
      port: 8443,
      transport: 'h2',
      authentication: 'basic',
      username: 'identity',
      password: 'p@ss',
      targetTemplate: '/.well-known/masque/udp/{target_host}/{target_port}/',
      sni: 'edge.example',
      allowInsecure: true,
    })
  })

  it('normalizes an IPv6 H3 no-auth authority', () => {
    expect(
      parseMasqueUrl(`masque://[2001:db8::1]:9443?transport=h3&auth=none&template=${masqueTemplate}`),
    ).toMatchObject({
      host: '2001:db8::1',
      port: 9443,
      transport: 'h3',
      authentication: 'none',
      sni: '2001:db8::1',
    })
  })

  it('rejects implicit, ambiguous, and malformed source shapes', () => {
    for (const link of [
      `https://proxy.example:443?transport=h2&auth=none&template=${masqueTemplate}`,
      `masque://proxy.example:443?auth=none&template=${masqueTemplate}`,
      `masque://proxy.example:443?transport=h2&auth=none&template=${masqueTemplate}&fallback=h3`,
      `masque://proxy.example:443?transport=h2&transport=h3&auth=none&template=${masqueTemplate}`,
      `masque://user@proxy.example:443?transport=h2&auth=none&template=${masqueTemplate}`,
      `masque://proxy.example:443?transport=h2&auth=basic&template=${masqueTemplate}`,
      'masque://proxy.example:443?transport=h2&auth=none&template=%2Fudp%2F%7Btarget_host%7D%2F',
    ]) {
      expect(parseMasqueUrl(link), link).toBeNull()
    }
  })
})

describe('parseSocks5Url', () => {
  it('should parse basic SOCKS5 URL', () => {
    const result = parseSocks5Url('socks5://example.com:1080#my-socks')
    expect(result).toEqual({
      host: 'example.com',
      port: 1080,
      username: '',
      password: '',
      name: 'my-socks',
    })
  })
})

describe('parseSSUrl', () => {
  it('should parse SS URL with base64 encoded userinfo', () => {
    // aes-256-gcm:password encoded as YWVzLTI1Ni1nY206cGFzc3dvcmQ=
    const result = parseSSUrl('ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@example.com:8388#my-ss')
    expect(result).toMatchObject({
      method: 'aes-256-gcm',
      password: 'password',
      server: 'example.com',
      port: 8388,
      name: 'my-ss',
    })
  })

  it('should parse SS2022 URL with plain userinfo', () => {
    const result = parseSSUrl(
      'ss://2022-blake3-aes-128-gcm:%2BmPWWGB%2F%2FPLkjgiXVeWszg%3D%3D@example.com:8388#my-ss2022',
    )
    expect(result).toMatchObject({
      type: 'ss2022',
      method: '2022-blake3-aes-128-gcm',
      password: '+mPWWGB//PLkjgiXVeWszg==',
      server: 'example.com',
      port: 8388,
      name: 'my-ss2022',
    })
  })

  it('should parse SS2022 chacha20 URL with plain userinfo', () => {
    const result = parseSSUrl(
      'ss://2022-blake3-chacha20-poly1305:MTIzNDU2Nzg5MDEyMzQ1NjEyMzQ1Njc4OTAxMjM0NTY%3D@example.com:8388#my-ss2022',
    )
    expect(result).toMatchObject({
      type: 'ss2022',
      method: '2022-blake3-chacha20-poly1305',
      password: 'MTIzNDU2Nzg5MDEyMzQ1NjEyMzQ1Njc4OTAxMjM0NTY=',
      server: 'example.com',
      port: 8388,
      name: 'my-ss2022',
    })
  })
})

describe('parseTrojanUrl', () => {
  it('should parse basic Trojan URL', () => {
    const result = parseTrojanUrl('trojan://password123@example.com:443?sni=example.com#my-trojan')
    expect(result).toMatchObject({
      password: 'password123',
      server: 'example.com',
      port: 443,
      name: 'my-trojan',
      peer: 'example.com',
      method: 'origin',
      obfs: 'none',
    })
  })

  it('should parse Trojan-Go HTTPUpgrade and gRPC transports', () => {
    expect(
      parseTrojanUrl(
        'trojan-go://password@example.com:443?type=httpupgrade&host=front.example&path=%2Fup&sni=sni.example&allowInsecure=1&alpn=h2#trojan-hu',
      ),
    ).toMatchObject({
      method: 'origin',
      obfs: 'httpupgrade',
      host: 'front.example',
      path: '/up',
      peer: 'sni.example',
      allowInsecure: true,
      alpn: 'h2',
    })

    expect(
      parseTrojanUrl(
        'trojan-go://password@example.com:443?type=grpc&serviceName=GunService&host=front.example#trojan-grpc',
      ),
    ).toMatchObject({
      method: 'origin',
      obfs: 'grpc',
      host: 'front.example',
      path: 'GunService',
    })
  })
})

describe('parseHysteria2Url', () => {
  it('should parse Hysteria2 URL', () => {
    const result = parseHysteria2Url('hysteria2://auth@example.com:443/?sni=example.com#my-hy2')
    expect(result).toMatchObject({
      auth: 'auth',
      server: 'example.com',
      port: 443,
      name: 'my-hy2',
      sni: 'example.com',
    })
  })

  it('should parse hy2:// prefix', () => {
    const result = parseHysteria2Url('hy2://auth@example.com:443#test')
    expect(result).toMatchObject({
      auth: 'auth',
      server: 'example.com',
      port: 443,
    })
  })

  it('should parse Hysteria2 with ports (hopping)', () => {
    const result = parseHysteria2Url(
      'hysteria2://auth@example.com:10000-20000,443?pinSHA256=abcd&maxTx=4096&maxRx=8192#hopping',
    )
    expect(result).toMatchObject({
      auth: 'auth',
      server: 'example.com',
      port: 10000,
      ports: '10000-20000,443',
      pinSHA256: 'abcd',
      maxTx: '4096',
      maxRx: '8192',
    })
  })

  it('should still import legacy Hysteria2 ports query for migration', () => {
    const result = parseHysteria2Url('hysteria2://auth@example.com:443/?ports=10000-20000#hopping')
    expect(result).toMatchObject({
      auth: 'auth',
      server: 'example.com',
      port: 443,
      ports: '10000-20000',
    })
  })

  it('should parse Hysteria2 salamander obfs', () => {
    const result = parseHysteria2Url('hysteria2://auth@example.com:443?obfs=salamander&obfs-password=secret#hy2-obfs')
    expect(result).toMatchObject({
      auth: 'auth',
      server: 'example.com',
      port: 443,
      obfs: 'salamander',
      obfsPassword: 'secret',
    })
  })
})

describe('parseV2rayUrl', () => {
  it('should parse VLESS URL', () => {
    const result = parseV2rayUrl('vless://uuid-here@example.com:443?type=tcp&security=tls#my-vless')
    expect(result).toMatchObject({
      protocol: 'vless',
      id: 'uuid-here',
      add: 'example.com',
      port: 443,
      ps: 'my-vless',
      net: 'tcp',
      tls: 'tls',
    })
  })

  it('should parse VLESS URL with WebSocket', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws#ws-vless',
    )
    expect(result).toMatchObject({
      protocol: 'vless',
      id: 'uuid',
      net: 'ws',
      tls: 'tls',
      host: 'example.com',
      path: '/ws',
    })
  })

  it('should parse VLESS URL with gRPC', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=grpc&security=tls&serviceName=myservice&mode=gun#grpc-vless',
    )
    expect(result).toMatchObject({
      protocol: 'vless',
      net: 'grpc',
      path: 'myservice',
      grpcMode: 'gun',
    })
  })

  it('should parse VLESS URL with REALITY', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=tcp&security=reality&pbk=publickey&sid=shortid&fp=chrome&sni=sni.example.com&flow=xtls-rprx-vision#reality-vless',
    )
    expect(result).toMatchObject({
      protocol: 'vless',
      tls: 'reality',
      pbk: 'publickey',
      sid: 'shortid',
      fp: 'chrome',
      sni: 'sni.example.com',
      flow: 'xtls-rprx-vision',
    })
  })

  it('should parse VLESS URL with mKCP and seed', () => {
    const result = parseV2rayUrl('vless://uuid@example.com:443?type=kcp&headerType=wireguard&seed=myseed#kcp-vless')
    expect(result).toMatchObject({
      protocol: 'vless',
      net: 'kcp',
      type: 'wireguard',
      path: 'myseed',
    })
  })

  it('should parse VLESS URL with HTTP/2 (http type)', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=http&security=tls&host=example.com&path=%2Fh2#h2-vless',
    )
    expect(result).toMatchObject({
      protocol: 'vless',
      net: 'h2', // normalized from 'http'
      tls: 'tls',
      host: 'example.com',
      path: '/h2',
    })
  })

  it('should parse legacy VMess base64 JSON format', () => {
    const vmessConfig = btoa(
      JSON.stringify({
        ps: 'test-vmess',
        add: 'example.com',
        port: 443,
        id: 'uuid-test',
        aid: 0,
        net: 'tcp',
        tls: 'tls',
        scy: 'auto',
      }),
    )
    const result = parseV2rayUrl(`vmess://${vmessConfig}`)
    expect(result).toMatchObject({
      protocol: 'vmess',
      ps: 'test-vmess',
      add: 'example.com',
      port: 443,
      id: 'uuid-test',
      net: 'tcp',
      tls: 'tls',
      scy: 'auto',
    })
  })

  it('should parse VMess standard URL format', () => {
    const result = parseV2rayUrl(
      'vmess://uuid-here@example.com:443?type=ws&security=tls&host=example.com&path=%2Fws&encryption=auto#standard-vmess',
    )
    expect(result).toMatchObject({
      protocol: 'vmess',
      id: 'uuid-here',
      add: 'example.com',
      port: 443,
      ps: 'standard-vmess',
      net: 'ws',
      tls: 'tls',
      host: 'example.com',
      path: '/ws',
      scy: 'auto',
    })
  })

  it('should parse VMess standard URL with HTTP/2', () => {
    const result = parseV2rayUrl(
      'vmess://uuid-here@example.com:443?type=http&security=tls&host=example.com&path=%2Fh2&encryption=auto#vmess-h2',
    )
    expect(result).toMatchObject({
      protocol: 'vmess',
      id: 'uuid-here',
      add: 'example.com',
      port: 443,
      ps: 'vmess-h2',
      net: 'h2',
      tls: 'tls',
      host: 'example.com',
      path: '/h2',
      scy: 'auto',
    })
  })

  it('should parse VMess without TLS (naked)', () => {
    const result = parseV2rayUrl('vmess://uuid@example.com:31415?encryption=none#VMessTCPNaked')
    expect(result).toMatchObject({
      protocol: 'vmess',
      id: 'uuid',
      add: 'example.com',
      port: 31415,
      scy: 'none',
      tls: 'none',
    })
  })

  it('should parse VLESS with HTTPUpgrade', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=httpupgrade&security=tls&host=example.com&path=%2Fupgrade#httpupgrade-vless',
    )
    expect(result).toMatchObject({
      protocol: 'vless',
      net: 'httpupgrade',
      host: 'example.com',
      path: '/upgrade',
    })
  })

  it('should parse VLESS with Meek and mux', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=meek&security=tls&url=https%3A%2F%2Ffront.example%2Fmeek&mux=1#meek-vless',
    )
    expect(result).toMatchObject({
      protocol: 'vless',
      net: 'meek',
      tls: 'tls',
      path: 'https://front.example/meek',
      mux: true,
    })
  })

  it('should handle ALPN correctly', () => {
    const result = parseV2rayUrl('vless://uuid@example.com:443?type=tcp&security=tls&alpn=h2%2Chttp%2F1.1#alpn-test')
    expect(result).toMatchObject({
      alpn: 'h2,http/1.1',
    })
  })

  it('should parse XHTTP extra JSON into advanced fields', () => {
    const extra = encodeURIComponent(
      JSON.stringify({
        xPaddingBytes: '100-200',
        xPaddingObfsMode: true,
        xPaddingHeader: 'X-Pad',
        xPaddingPlacement: 'header',
        xPaddingMethod: 'tokenish',
        uplinkHTTPMethod: 'PUT',
        sessionIDPlacement: 'header',
        sessionIDKey: 'X-Session',
        seqPlacement: 'query',
        uplinkDataPlacement: 'cookie',
        uplinkDataKey: 'x_data',
        uplinkChunkSize: '256-512',
        noSSEHeader: true,
        scMaxBufferedPosts: 12,
        downloadSettings: {
          address: 'example.net',
          port: 443,
        },
        xmux: {
          maxConcurrency: '8-16',
        },
      }),
    )

    const result = parseV2rayUrl(
      `vless://uuid@example.com:443?type=xhttp&security=tls&mode=auto&extra=${extra}#xhttp-advanced`,
    )

    expect(result).toMatchObject({
      net: 'xhttp',
      xhttpMode: 'auto',
      grpcMode: 'gun',
      xPaddingBytes: '100-200',
      xPaddingObfsMode: true,
      xPaddingHeader: 'X-Pad',
      xPaddingPlacement: 'header',
      xPaddingMethod: 'tokenish',
      uplinkHTTPMethod: 'PUT',
      sessionPlacement: 'header',
      sessionKey: 'X-Session',
      seqPlacement: 'query',
      uplinkDataPlacement: 'cookie',
      uplinkDataKey: 'x_data',
      uplinkChunkSize: '256-512',
      noSSEHeader: true,
      scMaxBufferedPosts: 12,
    })

    expect(result?.downloadSettingsRaw).toContain('"address": "example.net"')
    expect(result?.xmuxRaw).toContain('"maxConcurrency": "8-16"')
    expect(result?.xhttpExtra).toContain('sessionIDPlacement')
  })

  it('should keep xhttp mode out of grpc mode for form validation', () => {
    const result = parseV2rayUrl(
      'vless://uuid@example.com:443?type=xhttp&security=tls&path=%2Fxhttp&mode=packet-up&alpn=h3#xhttp',
    )

    expect(result).toMatchObject({
      protocol: 'vless',
      net: 'xhttp',
      path: '/xhttp',
      xhttpMode: 'packet-up',
      grpcMode: 'gun',
      alpn: 'h3',
    })
  })
})

describe('parseNodeUrl', () => {
  it('should auto-detect HTTP protocol', () => {
    const result = parseNodeUrl('http://example.com:8080#proxy')
    expect(result?.type).toBe('http')
  })

  it('should auto-detect SOCKS5 protocol', () => {
    const result = parseNodeUrl('socks5://example.com:1080')
    expect(result?.type).toBe('socks5')
  })

  it('should auto-detect SS protocol', () => {
    const result = parseNodeUrl('ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ=@example.com:8388')
    expect(result?.type).toBe('ss')
  })

  it('should auto-detect Trojan protocol', () => {
    const result = parseNodeUrl('trojan://password@example.com:443')
    expect(result?.type).toBe('trojan')
  })

  it('should auto-detect VMess protocol', () => {
    const vmessConfig = btoa(JSON.stringify({ add: 'example.com', port: 443 }))
    const result = parseNodeUrl(`vmess://${vmessConfig}`)
    expect(result?.type).toBe('v2ray')
  })

  it('should auto-detect explicit MASQUE protocol', () => {
    const result = parseNodeUrl(
      `masque://proxy.example:443?transport=h3&auth=none&template=${masqueTemplate}#connect-udp`,
    )
    expect(result?.type).toBe('masque')
  })

  it('should return null for unknown protocol', () => {
    expect(parseNodeUrl('unknown://example.com')).toBeNull()
  })
})
