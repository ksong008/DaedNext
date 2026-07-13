import { parseNodeUrl } from '@daeuniverse/dae-node-parser'
import { describe, expect, it, vi } from 'vitest'

import { resolveNodeTransport } from '../../../apis/node_transport'

import fixture from './fixtures/resident_protocol_exact_shapes.json'
type ExactShape = (typeof fixture.shapes)[number]

async function generateFixtureLink(shape: ExactShape): Promise<string> {
  const [{ hysteria2Protocol, v2rayProtocol }, { httpProtocol, socks5Protocol }] = await Promise.all([
    import('./complex'),
    import('./simple'),
  ])
  const form = shape.form as Record<string, unknown>
  switch (shape.webGenerator) {
    case 'socks5':
      return socks5Protocol.generateLink({
        ...socks5Protocol.defaultValues,
        ...form,
      } as typeof socks5Protocol.defaultValues)
    case 'http':
      return httpProtocol.generateLink({
        ...httpProtocol.defaultValues,
        ...form,
      } as typeof httpProtocol.defaultValues)
    case 'hysteria2':
      return hysteria2Protocol.generateLink({
        ...hysteria2Protocol.defaultValues,
        ...form,
      } as typeof hysteria2Protocol.defaultValues)
    case 'v2ray':
      return v2rayProtocol.generateLink({
        ...v2rayProtocol.defaultValues,
        ...form,
      } as typeof v2rayProtocol.defaultValues)
    default:
      throw new Error(`unsupported fixture generator: ${shape.webGenerator}`)
  }
}

function fixtureProtocolForWeb(shape: ExactShape): string {
  const form = shape.form as Record<string, unknown>
  if (shape.webGenerator === 'http' || shape.webGenerator === 'v2ray') {
    return String(form.protocol)
  }
  if (shape.webGenerator === 'socks5') return 'socks5'
  return 'hysteria2'
}

function generatedWireSecurity(link: string, shape: ExactShape): string {
  if (shape.webGenerator === 'hysteria2') return 'quic'
  if (shape.webGenerator === 'http') {
    return new URL(link).protocol === 'https:' ? 'tls' : 'none'
  }
  if (shape.webGenerator === 'socks5') return 'none'
  if (link.startsWith('vmess://')) {
    const body = JSON.parse(atob(link.slice('vmess://'.length))) as { tls?: string }
    return body.tls || 'none'
  }
  return new URL(link).searchParams.get('security') || 'none'
}

describe('shared resident exact-shape fixture contract', () => {
  it('keeps WebUI generation and parser normalization aligned with Rust exact shapes', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })
    expect(fixture.schemaVersion).toBe(1)
    expect(fixture.shapes.length).toBeGreaterThanOrEqual(8)

    for (const shape of fixture.shapes) {
      const link = await generateFixtureLink(shape)
      const webProtocol = fixtureProtocolForWeb(shape)

      expect(parseNodeUrl(link), shape.id).not.toBeNull()
      expect(resolveNodeTransport(link, webProtocol), shape.id).toBe(shape.webTransport)
      expect(generatedWireSecurity(link, shape), shape.id).toBe(shape.wireSecurity)
    }
  })
})
