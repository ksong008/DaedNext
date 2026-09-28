import { parseNodeUrl } from '@daeuniverse/dae-node-parser'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('node TLS verification overrides', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['http', 'https', 'allowInsecure'],
    ['trojan', 'trojan', 'allowInsecure'],
    ['trojan', 'trojan-go', 'allowInsecure'],
    ['tuic', 'tuic', 'allow_insecure'],
    ['juicity', 'juicity', 'allow_insecure'],
    ['hysteria2', 'hysteria2', 'insecure'],
    ['anytls', 'anytls', 'insecure'],
    ['v2ray', 'vless', 'allowInsecure'],
    ['v2ray', 'vmess', 'allowInsecure'],
  ])('preserves unset/false/true through manual creation and editing: %s / %s', async (id, scheme, key) => {
    vi.stubGlobal('location', { hostname: '127.0.0.1', origin: 'http://127.0.0.1', protocol: 'http:' })
    const { getProtocol } = await import('./registry')
    const protocol = getProtocol(id)!
    const form = {
      ...protocol.defaultValues,
      protocol: scheme,
      host: 'example.com',
      server: 'example.com',
      add: 'example.com',
      port: 443,
      auth: 'secret',
      password: 'secret',
      uuid: '01234567-89ab-cdef-0123-456789abcdef',
      id: '01234567-89ab-cdef-0123-456789abcdef',
      tls: 'tls',
      ...(scheme === 'trojan-go' ? { obfs: 'websocket', path: '/' } : {}),
    }
    expect(protocol.defaultValues.allowInsecure).toBe(false)
    for (const override of [null, false, true]) {
      const valid = protocol.schema.parse({ ...form, allowInsecure: override })
      const link = protocol.generateLink(valid)
      expect(link.startsWith(`${scheme}://`)).toBe(true)
      if (scheme === 'vmess') {
        const body = JSON.parse(atob(link.slice('vmess://'.length)))
        if (override === null) expect(body).not.toHaveProperty(key)
        else expect(body[key]).toBe(override)
      } else {
        const value = new URL(link).searchParams.get(key)
        if (override === null) expect(value).toBeNull()
        else expect(override ? ['1', 'true'] : ['0', 'false']).toContain(value)
      }
      expect(parseNodeUrl(link)).toMatchObject({ data: { allowInsecure: override } })
      const parsed = protocol.parseLink!(link)
      expect(parsed?.allowInsecure).toBe(override)
      const edited = protocol.schema.parse({ ...protocol.defaultValues, ...parsed, name: 'renamed', ps: 'renamed' })
      expect(protocol.parseLink!(protocol.generateLink(edited))?.allowInsecure).toBe(override)
    }
  })
})
