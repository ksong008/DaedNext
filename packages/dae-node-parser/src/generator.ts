import type { GenerateHysteria2URLParams, GenerateURLParams } from './types'

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
