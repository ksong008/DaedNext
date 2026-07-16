import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('normalizeEndpointURL', () => {
  it('keeps an /api endpoint rooted at /api', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const { normalizeEndpointURL } = await import('./client')

    expect(normalizeEndpointURL('http://127.0.0.1:2023/api')).toBe('http://127.0.0.1:2023/api')
  })

  it('appends /api to non-api endpoint roots', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const { normalizeEndpointURL } = await import('./client')

    expect(normalizeEndpointURL('http://127.0.0.1:2023/custom')).toBe('http://127.0.0.1:2023/custom/api')
  })

  it('trims API resource paths to the API root', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const { normalizeEndpointURL } = await import('./client')

    expect(normalizeEndpointURL('http://127.0.0.1:2023/api/configs/1')).toBe('http://127.0.0.1:2023/api')
    expect(normalizeEndpointURL('http://127.0.0.1:2023/configs/1')).toBe('http://127.0.0.1:2023/api')
    expect(normalizeEndpointURL('http://127.0.0.1:2023/configs/api')).toBe('http://127.0.0.1:2023/api')
    expect(normalizeEndpointURL('http://127.0.0.1:2023/panel/api/configs/1')).toBe('http://127.0.0.1:2023/panel/api')
    expect(normalizeEndpointURL('http://127.0.0.1:2023/panel/configs/api')).toBe('http://127.0.0.1:2023/panel/api')
  })
})

describe('aPI client', () => {
  it('preserves typed retryable HTTP errors for caller-owned recovery', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: 'request header read timeout',
            errorCode: 'request_header_timeout',
            retryable: true,
          }),
          {
            status: 408,
            headers: { 'content-type': 'application/json' },
          },
        )
      }),
    )

    const { APIClient, APIResponseError } = await import('./client')
    const client = new APIClient('http://127.0.0.1:2023/api')
    const error = await client
      .post('/nodes/latencies', {}, undefined, { suppressErrorToast: true })
      .catch((value: unknown) => value)

    expect(error).toBeInstanceOf(APIResponseError)
    expect(error).toMatchObject({
      status: 408,
      errorCode: 'request_header_timeout',
      retryable: true,
    })
  })

  it('forwards a caller abort signal to fetch', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { APIClient } = await import('./client')
    const caller = new AbortController()
    const client = new APIClient('http://127.0.0.1:2023/api')
    const request = client.get('/general', undefined, { signal: caller.signal })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    caller.abort(new Error('navigation cancelled'))
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await expect(request).rejects.toThrow('navigation cancelled')
  })

  it('resolves leading-slash paths under the /api base path', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ ok: true, url: String(input) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { APIClient } = await import('./client')
    const client = new APIClient('http://127.0.0.1:2023/api')
    await client.get('/auth/status')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:2023/api/auth/status')
  })

  it('builds event API URLs with query parameters', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const { buildAPIURL } = await import('./client')

    const url = buildAPIURL('http://127.0.0.1:2023/api', '/events/runtime', {
      windowSec: 600,
      maxPoints: 240,
    })

    expect(url.toString()).toBe('http://127.0.0.1:2023/api/events/runtime?windowSec=600&maxPoints=240')
  })

  it('reports static WebUI handler responses as endpoint errors', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('Method Not Allowed\n\nmethod should be GET or HEAD\n', {
          status: 405,
          statusText: 'Method Not Allowed',
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      }),
    )

    const { APIClient } = await import('./client')
    const client = new APIClient('http://127.0.0.1:2023/configs')

    await expect(client.put('/1', {})).rejects.toThrow(
      'API request reached the WebUI static handler; check the endpoint URL and make sure it points to /api',
    )
  })

  it('keeps a newer token when a stale authenticated request receives 401', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: 'authentication required' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const { tokenAtom } = await import('~/store')
    const { APIClient } = await import('./client')

    tokenAtom.set('new-token')
    const staleClient = new APIClient('http://127.0.0.1:2023/api', 'old-token')
    await expect(staleClient.get('/general')).rejects.toThrow('authentication required')

    expect(tokenAtom.get()).toBe('new-token')
  })

  it('keeps a newer token when a stale unauthenticated request receives 401', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: 'authentication required' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const { tokenAtom } = await import('~/store')
    const { APIClient } = await import('./client')

    tokenAtom.set('new-token')
    const staleClient = new APIClient('http://127.0.0.1:2023/api')
    await expect(staleClient.get('/general')).rejects.toThrow('authentication required')

    expect(tokenAtom.get()).toBe('new-token')
  })

  it('clears the current token when the active authenticated request receives 401', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: 'authentication required' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const { tokenAtom } = await import('~/store')
    const { APIClient } = await import('./client')

    tokenAtom.set('current-token')
    const client = new APIClient('http://127.0.0.1:2023/api', 'current-token')
    await expect(client.get('/general')).rejects.toThrow('authentication required')

    expect(tokenAtom.get()).toBe('')
  })
})
