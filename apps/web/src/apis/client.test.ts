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
})

describe('aPI client', () => {
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

  it('builds SSE-compatible API URLs with query parameters', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const { buildAPIURL } = await import('./client')

    const url = buildAPIURL('http://127.0.0.1:2023/api', '/events/runtime', {
      windowSec: 600,
      maxPoints: 240,
      access_token: 'test-token',
    })

    expect(url.toString()).toBe(
      'http://127.0.0.1:2023/api/events/runtime?windowSec=600&maxPoints=240&access_token=test-token',
    )
  })
})
