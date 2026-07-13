import { parseNodeUrl } from '@daeuniverse/dae-node-parser'

const VLESS_FLOW_PREFIX_REGEX = /^xtls-rprx-/

function formatVlessFlowTransport(flow: string): string {
  return flow.replace(VLESS_FLOW_PREFIX_REGEX, '')
}

function formatVlessRealityTransport(flow?: string): string {
  if (!flow || flow === 'none') return 'reality'
  return `reality/${formatVlessFlowTransport(flow)}`
}

export function deriveTransport(link: string, protocol: string): string | null {
  const parsed = parseNodeUrl(link)
  if (parsed?.type === 'v2ray' && parsed.data && typeof parsed.data === 'object' && 'net' in parsed.data) {
    if ('protocol' in parsed.data && parsed.data.protocol === 'vless') {
      const flow = 'flow' in parsed.data && typeof parsed.data.flow === 'string' ? parsed.data.flow : undefined
      const security = 'tls' in parsed.data && typeof parsed.data.tls === 'string' ? parsed.data.tls : undefined
      if (security === 'reality') {
        return formatVlessRealityTransport(flow)
      }
      if (flow && flow !== 'none') {
        return formatVlessFlowTransport(flow)
      }
    }

    const net = parsed.data.net
    return typeof net === 'string' ? net : null
  }
  if (parsed?.type === 'trojan' && parsed.data && typeof parsed.data === 'object' && 'obfs' in parsed.data) {
    return parsed.data.obfs === 'websocket' ? 'ws' : null
  }
  if (parsed?.type === 'ss' && parsed.data && typeof parsed.data === 'object') {
    if ('type' in parsed.data && parsed.data.type === 'ss2022') {
      return 'ss2022'
    }
    if (
      'plugin' in parsed.data &&
      parsed.data.plugin === 'v2ray-plugin' &&
      'mode' in parsed.data &&
      typeof parsed.data.mode === 'string'
    ) {
      return parsed.data.mode
    }
    if ('plugin' in parsed.data) {
      return typeof parsed.data.plugin === 'string' && parsed.data.plugin ? parsed.data.plugin : null
    }
  }
  if (parsed?.type === 'masque' && parsed.data && typeof parsed.data === 'object' && 'transport' in parsed.data) {
    return parsed.data.transport === 'h2' || parsed.data.transport === 'h3' ? parsed.data.transport : null
  }
  if (protocol === 'http' || protocol === 'https' || protocol === 'socks5') {
    return protocol
  }
  return null
}

export function resolveNodeTransport(link: string, protocol: string, transport?: string | null): string | null {
  return deriveTransport(link, protocol) ?? transport ?? null
}
