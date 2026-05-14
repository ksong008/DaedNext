import { parseNodeUrl } from '@daeuniverse/dae-node-parser'

export function deriveTransport(link: string, protocol: string): string | null {
  const parsed = parseNodeUrl(link)
  if (parsed?.type === 'v2ray' && parsed.data && typeof parsed.data === 'object' && 'net' in parsed.data) {
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
  if (protocol === 'http' || protocol === 'https' || protocol === 'socks5') {
    return protocol
  }
  return null
}
