import type { GenerateHysteria2URLParams, GenerateURLParams, MasqueConfig } from './types'

function formatURLAuthorityHost(host: string): string {
  const normalized = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  return normalized.includes(':') ? `[${normalized}]` : normalized
}

/**
 * Generate a URL from parameters
 */
export function generateURL({
  username,
  password,
  protocol,
  host,
  port,
  params,
  hash,
  path,
}: GenerateURLParams): string {
  // Build the URL manually to avoid external dependencies
  let url = `${protocol || 'http'}://`

  // Add auth if present
  if (username || password) {
    url += encodeURIComponent(username || '')

    if (password) {
      url += `:${encodeURIComponent(password)}`
    }

    url += '@'
  }

  // Add host and port
  url += host || ''

  if (port) {
    url += `:${port}`
  }

  // Add path
  if (path) {
    url += path
  }

  // Add query params
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        searchParams.append(key, String(value))
      }
    }

    const queryString = searchParams.toString()

    if (queryString) {
      url += `?${queryString}`
    }
  }

  // Add hash
  if (hash) {
    url += `#${encodeURIComponent(hash)}`
  }

  return url
}

/**
 * Generate Hysteria2 URL
 */
export function generateHysteria2URL({ protocol, auth, host, port, params, hash }: GenerateHysteria2URLParams): string {
  const { ports, ...queryParams } = params
  const portValue = typeof ports === 'string' && ports.trim() ? ports.trim() : String(port)
  const encodedAuth = encodeURIComponent(auth)
  let url = `${protocol}://${encodedAuth}@${host}:${portValue}`

  const searchParams = new URLSearchParams()

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '' && value !== false && value !== 0) {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  if (queryString) {
    url += `?${queryString}`
  }

  if (hash) {
    url += `#${encodeURIComponent(hash)}`
  }

  return url
}

/**
 * Generate AnyTLS URL
 */
export function generateAnytlsURL({ protocol, auth, host, port, params }: GenerateHysteria2URLParams): string {
  // Use Hysteria2 generator structure as they are similar
  return generateHysteria2URL({ protocol, auth, host, port, params })
}

/**
 * Generate an explicit CONNECT-UDP/MASQUE source link.
 *
 * ALPN is deliberately absent from the source shape: the selected transport
 * owns that invariant (`h2` for HTTP/2, `h3` for HTTP/3).
 */
export function generateMasqueURL(config: MasqueConfig): string {
  const host = formatURLAuthorityHost(config.host)
  const userInfo =
    config.authentication === 'basic'
      ? `${encodeURIComponent(config.username)}${config.password ? `:${encodeURIComponent(config.password)}` : ''}@`
      : ''
  const params = new URLSearchParams()
  params.set('transport', config.transport)
  params.set('auth', config.authentication)
  params.set('template', config.targetTemplate)
  if (config.sni) params.set('sni', config.sni)
  if (config.allowInsecure) params.set('allowInsecure', '1')

  const fragment = config.name ? `#${encodeURIComponent(config.name)}` : ''
  return `masque://${userInfo}${host}:${config.port}?${params.toString()}${fragment}`
}
