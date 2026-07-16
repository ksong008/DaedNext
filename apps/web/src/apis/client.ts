import type { APIRequestOptions } from './request_abort'
import { toast } from 'sonner'

import { tokenAtom } from '~/store'
import { APIRequestTimeoutError, createAPIRequestAbortScope, DEFAULT_API_REQUEST_TIMEOUT_MS } from './request_abort'

export type APIQueryPrimitive = string | number | boolean
export type APIQueryValue = APIQueryPrimitive | null | undefined | APIQueryPrimitive[]

export interface APIClientInterface {
  get: <T>(path: string, query?: Record<string, APIQueryValue>, options?: APIRequestOptions) => Promise<T>
  post: <T>(
    path: string,
    body?: unknown,
    query?: Record<string, APIQueryValue>,
    options?: APIRequestOptions,
  ) => Promise<T>
  put: <T>(
    path: string,
    body?: unknown,
    query?: Record<string, APIQueryValue>,
    options?: APIRequestOptions,
  ) => Promise<T>
  patch: <T>(
    path: string,
    body?: unknown,
    query?: Record<string, APIQueryValue>,
    options?: APIRequestOptions,
  ) => Promise<T>
  delete: <T>(
    path: string,
    body?: unknown,
    query?: Record<string, APIQueryValue>,
    options?: APIRequestOptions,
  ) => Promise<T>
}

const leadingSlashesRE = /^\/+/
const trailingSlashesRE = /\/+$/
const trailingSlashRE = /\/$/
const staticFileServerMethodHint = 'method should be GET or HEAD'
const apiSegment = 'api'
const apiResourceSegments = new Set([
  'auth',
  'configs',
  'dns',
  'events',
  'general',
  'groups',
  'logs',
  'nodes',
  'openapi.json',
  'profiles',
  'routings',
  'runtime',
  'subscriptions',
  'user',
])
const frontendRouteSegments = new Set(['setup'])

const httpMethod = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
} as const

export function buildAPIURL(endpointURL: string, path: string, query?: Record<string, APIQueryValue>) {
  const normalizedPath = path.replace(leadingSlashesRE, '')
  const url = new URL(normalizedPath, `${endpointURL}/`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item))
        }
        continue
      }
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

function canonicalizeEndpointPathname(pathname: string) {
  const trimmedPath = pathname.replace(trailingSlashesRE, '')

  if (trimmedPath === '' || trimmedPath === '/') {
    return '/api'
  }

  const segments = trimmedPath.split('/').filter(Boolean)
  const normalizedSegments = segments.map((segment) => segment.toLowerCase())
  const apiIndex = normalizedSegments.indexOf(apiSegment)
  const resourceIndex = normalizedSegments.findIndex(
    (segment) => apiResourceSegments.has(segment) || frontendRouteSegments.has(segment),
  )

  if (resourceIndex >= 0 && (apiIndex === -1 || resourceIndex < apiIndex)) {
    return `/${[...segments.slice(0, resourceIndex), apiSegment].join('/')}`
  }

  if (apiIndex >= 0) {
    return `/${[...segments.slice(0, apiIndex), apiSegment].join('/')}`
  }

  return `/${[...segments, apiSegment].join('/')}`
}

export function normalizeEndpointURL(raw: string): string {
  const url = new URL(raw)
  url.pathname = canonicalizeEndpointPathname(url.pathname)
  url.search = ''
  url.hash = ''
  return url.toString().replace(trailingSlashRE, '')
}

function parseResponsePayload(text: string, contentType: string | null): unknown {
  if (!text) {
    return {}
  }
  if (contentType?.includes('application/json')) {
    return JSON.parse(text)
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function responseErrorMessage(response: Response, payload: unknown): string {
  if (typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }
  if (typeof payload === 'string' && payload.includes(staticFileServerMethodHint)) {
    return 'API request reached the WebUI static handler; check the endpoint URL and make sure it points to /api'
  }
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }
  return `${response.status} ${response.statusText}`
}

export class APIResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: string | null,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'APIResponseError'
  }
}

function responseErrorMetadata(payload: unknown) {
  if (typeof payload !== 'object' || !payload) {
    return { errorCode: null, retryable: false }
  }
  const record = payload as Record<string, unknown>
  return {
    errorCode: typeof record.errorCode === 'string' ? record.errorCode : null,
    retryable: record.retryable === true,
  }
}

export class APIClient implements APIClientInterface {
  constructor(
    private readonly endpointURL: string,
    private readonly token?: string,
    private readonly requestTimeoutMs = DEFAULT_API_REQUEST_TIMEOUT_MS,
  ) {}

  get<T>(path: string, query?: Record<string, APIQueryValue>, options?: APIRequestOptions) {
    return this.request<T>(httpMethod.get, path, undefined, query, options)
  }

  post<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>, options?: APIRequestOptions) {
    return this.request<T>(httpMethod.post, path, body, query, options)
  }

  put<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>, options?: APIRequestOptions) {
    return this.request<T>(httpMethod.put, path, body, query, options)
  }

  patch<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>, options?: APIRequestOptions) {
    return this.request<T>(httpMethod.patch, path, body, query, options)
  }

  delete<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>, options?: APIRequestOptions) {
    return this.request<T>(httpMethod.delete, path, body, query, options)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, APIQueryValue>,
    options?: APIRequestOptions,
  ): Promise<T> {
    const url = buildAPIURL(this.endpointURL, path, query)
    const abortScope = createAPIRequestAbortScope({
      signal: options?.signal,
      timeoutMs: options?.timeoutMs ?? this.requestTimeoutMs,
    })

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: abortScope.signal,
      })

      if (response.status === 401 && tokenAtom.get() === (this.token ?? '')) {
        tokenAtom.set('')
      }

      if (response.status === 204) {
        return undefined as T
      }

      const text = await response.text()
      const payload = parseResponsePayload(text, response.headers.get('content-type'))
      if (!response.ok) {
        const message = responseErrorMessage(response, payload)
        const metadata = responseErrorMetadata(payload)
        if (!options?.suppressErrorToast) {
          toast.error(message)
        }
        throw new APIResponseError(message, response.status, metadata.errorCode, metadata.retryable)
      }

      return payload as T
    } catch (error) {
      if (abortScope.signal.reason instanceof APIRequestTimeoutError) {
        throw abortScope.signal.reason
      }
      throw error
    } finally {
      abortScope.dispose()
    }
  }
}

export function toID(value: string | number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

export function toOptionalID(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  return String(value)
}

export function toNumericID(value: string): number {
  return Number.parseInt(value, 10)
}
