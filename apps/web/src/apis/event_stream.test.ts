import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('subscribeEventStream', () => {
  it('uses Authorization header instead of putting the token in the URL', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const messages: Array<{ event: string; data: string }> = []
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: log.entry\ndata: {"ok":true}\n\n'))
        controller.close()
      },
    })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(body, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/event-stream' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { subscribeEventStream } = await import('./event_stream')

    const unsubscribe = subscribeEventStream({
      url: 'http://127.0.0.1:2023/api/events/logs?level=all',
      token: 'secret-token',
      onMessage(message) {
        messages.push(message)
      },
    })

    await vi.waitFor(() => expect(messages).toHaveLength(1))
    unsubscribe()

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain('secret-token')
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer secret-token',
    })
    expect(messages[0]).toEqual({ event: 'log.entry', data: '{"ok":true}' })
  })
})
