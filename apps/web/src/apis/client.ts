import { toast } from 'sonner'

import { tokenAtom } from '~/store'

export type APIQueryPrimitive = string | number | boolean
export type APIQueryValue = APIQueryPrimitive | null | undefined | APIQueryPrimitive[]

export interface APIClientInterface {
  get: <T>(path: string, query?: Record<string, APIQueryValue>) => Promise<T>
  post: <T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) => Promise<T>
  put: <T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) => Promise<T>
  patch: <T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) => Promise<T>
  delete: <T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) => Promise<T>
}

export function buildAPIURL(endpointURL: string, path: string, query?: Record<string, APIQueryValue>) {
  const normalizedPath = path.replace(/^\/+/, '')
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

export function normalizeEndpointURL(raw: string): string {
  const url = new URL(raw)
  let pathname = url.pathname.replace(/\/+$/, '')

  if (pathname.endsWith('/api')) {
    url.pathname = pathname
  } else if (pathname === '' || pathname === '/') {
    url.pathname = '/api'
  } else {
    url.pathname = `${pathname}/api`
  }
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export class APIClient implements APIClientInterface {
  constructor(
    private readonly endpointURL: string,
    private readonly token?: string,
  ) {}

  get<T>(path: string, query?: Record<string, APIQueryValue>) {
    return this.request<T>(httpMethod.get, path, undefined, query)
  }

  post<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) {
    return this.request<T>(httpMethod.post, path, body, query)
  }

  put<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) {
    return this.request<T>(httpMethod.put, path, body, query)
  }

  patch<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) {
    return this.request<T>(httpMethod.patch, path, body, query)
  }

  delete<T>(path: string, body?: unknown, query?: Record<string, APIQueryValue>) {
    return this.request<T>(httpMethod.delete, path, body, query)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, APIQueryValue>,
  ): Promise<T> {
    const url = buildAPIURL(this.endpointURL, path, query)

    const response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (response.status === 401) {
      tokenAtom.set('')
    }

    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `${response.status} ${response.statusText}`
      toast.error(message)
      throw new Error(message)
    }

    return payload as T
  }
}

const httpMethod = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
} as const

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
