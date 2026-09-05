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

describe('event stream lifecycle', () => {
  it('frames fragmented CRLF and multiline data, flushes EOF and releases the reader', async () => {
    const body = new ReadableStream({
      start(controller) {
        for (const chunk of ['event: update\r', '\ndata: first\r\ndata:', ' second\r\n\r\ndata: eof']) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    )
    const { subscribeEventStream } = await import('./event_stream')
    const messages: Array<{ event: string; data: string }> = []
    const stop = subscribeEventStream({
      url: 'http://localhost/events',
      token: 't',
      onMessage: (message) => messages.push(message),
    })
    try {
      await vi.waitFor(() => expect(messages).toHaveLength(2))
      expect(messages).toEqual([
        { event: 'update', data: 'first\nsecond' },
        { event: 'message', data: 'eof' },
      ])
      expect(body.locked).toBe(false)
    } finally {
      stop()
    }
  })

  it('serializes repeated restarts through one backoff and cancels active readers on stop', async () => {
    vi.useFakeTimers()
    const bodies: ReadableStream[] = []
    const cancellations = vi.fn()
    const errors = vi.fn()
    const fetchMock = vi.fn(async () => {
      const body = new ReadableStream({ cancel: cancellations })
      bodies.push(body)
      return new Response(body)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { subscribeEventStream } = await import('./event_stream')
    const stop = subscribeEventStream({
      url: 'http://localhost/events',
      token: 't',
      onMessage: vi.fn(),
      onError: errors,
      retryDelayMs: 100,
    })
    try {
      await vi.advanceTimersByTimeAsync(0)
      stop.restart()
      stop.restart()
      await vi.advanceTimersByTimeAsync(0)
      expect(cancellations).toHaveBeenCalledTimes(1)
      expect(bodies[0].locked).toBe(false)
      expect(errors).toHaveBeenCalledTimes(1)
      stop.restart() // A watchdog during backoff does not start a second loop.
      await vi.advanceTimersByTimeAsync(99)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      stop()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(cancellations).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(bodies.every((body) => !body.locked)).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      stop()
      vi.useRealTimers()
    }
  })

  it('suppresses a late response after cancellation and stops HTTP-error retries', async () => {
    vi.useFakeTimers()
    let deliver!: (response: Response) => void
    const messages = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            deliver = resolve
          }),
      ),
    )
    const { subscribeEventStream } = await import('./event_stream')
    const stop = subscribeEventStream({ url: 'http://localhost/old', token: 'old', onMessage: messages })
    stop()
    const cancel = vi.fn()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: stale\n\n'))
      },
      cancel,
    })
    deliver(new Response(body))
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(messages).not.toHaveBeenCalled()
      expect(cancel).toHaveBeenCalledOnce()
      expect(body.locked).toBe(false)
      const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
      vi.stubGlobal('fetch', fetchMock)
      const cancelRetry = subscribeEventStream({
        url: 'http://localhost/new',
        token: 'new',
        onMessage: messages,
        retryDelayMs: 100,
      })
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      cancelRetry()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
