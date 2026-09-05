import type { APIQueryValue } from './client'

import { PAGE_INSTANCE_HEADER, pageInstanceId, pageLifecycleSignal } from '~/page_lifecycle'
import { buildAPIURL, normalizeEndpointURL } from './client'

const TRAILING_CARRIAGE_RETURN_RE = /\r$/

export interface EventStreamMessage {
  event: string
  data: string
}

export interface SubscribeEventStreamOptions {
  url: string
  token: string
  onMessage: (message: EventStreamMessage) => void
  onError?: () => void
  retryDelayMs?: number
}

export function buildEventStreamURL(endpointURL: string, path: string, query?: Record<string, APIQueryValue>) {
  return buildAPIURL(normalizeEndpointURL(endpointURL), path, query).toString()
}

export interface EventStreamSubscription {
  (): void
  restart: () => void
}

export function subscribeEventStream(options: SubscribeEventStreamOptions): EventStreamSubscription {
  const controller = new AbortController()
  const pageSignal = pageLifecycleSignal()
  let connection: AbortController | null = null
  const abortFromPage = () => controller.abort(pageSignal.reason)
  const abortConnection = () => connection?.abort(controller.signal.reason)
  controller.signal.addEventListener('abort', abortConnection, { once: true })
  if (pageSignal.aborted) abortFromPage()
  else pageSignal.addEventListener('abort', abortFromPage, { once: true })

  // This loop alone owns connection replacement and retry backoff. Restart requests
  // cancel the active reader; repeated requests cannot create parallel fetches.
  const run = async () => {
    let retryAttempt = 0
    while (!controller.signal.aborted) {
      connection = new AbortController()
      try {
        await readEventStream(
          {
            ...options,
            onMessage(message) {
              retryAttempt = 0
              options.onMessage(message)
            },
          },
          connection.signal,
        )
      } catch {
        // EOF, HTTP/read errors and requested restarts share the same retry path.
      } finally {
        connection = null
      }
      if (controller.signal.aborted) break
      options.onError?.()
      const delayMs = Math.min((options.retryDelayMs ?? 1500) * 2 ** retryAttempt, 30_000)
      retryAttempt = Math.min(retryAttempt + 1, 31)
      await waitForEventStreamRetry(controller.signal, delayMs)
    }
  }
  void run().finally(() => {
    pageSignal.removeEventListener('abort', abortFromPage)
    controller.signal.removeEventListener('abort', abortConnection)
  })
  const stop = () => {
    pageSignal.removeEventListener('abort', abortFromPage)
    controller.abort()
  }
  return Object.assign(stop, { restart: () => connection?.abort() })
}

async function readEventStream(options: SubscribeEventStreamOptions, signal: AbortSignal) {
  const response = await fetch(options.url, {
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${options.token}`,
      [PAGE_INSTANCE_HEADER]: pageInstanceId(),
    },
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`event stream failed: ${response.status} ${response.statusText}`)
  }

  const reader = response.body.getReader()
  let completed = false
  const cancelReader = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancelReader, { once: true })
  if (signal.aborted) cancelReader()
  try {
    const decoder = new TextDecoder()
    let buffer = ''
    const state = createEventStreamParser((message) => {
      if (!signal.aborted) options.onMessage(message)
    })

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = drainEventStreamLines(buffer, state)
    }

    buffer += decoder.decode()
    if (buffer) {
      state.line(buffer.replace(TRAILING_CARRIAGE_RETURN_RE, ''))
    }
    state.flush()
    completed = true
  } finally {
    signal.removeEventListener('abort', cancelReader)
    if (!completed) {
      await reader.cancel().catch(() => undefined)
    }
    reader.releaseLock()
  }
}

interface EventStreamParser {
  line: (line: string) => void
  flush: () => void
}

function createEventStreamParser(onMessage: (message: EventStreamMessage) => void): EventStreamParser {
  let eventName = 'message'
  let dataLines: string[] = []

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = 'message'
      return
    }
    onMessage({
      event: eventName,
      data: dataLines.join('\n'),
    })
    eventName = 'message'
    dataLines = []
  }

  return {
    line(line) {
      if (line === '') {
        dispatch()
        return
      }
      if (line.startsWith(':')) return

      const separator = line.indexOf(':')
      const field = separator === -1 ? line : line.slice(0, separator)
      const value = separator === -1 ? '' : line.slice(separator + (line[separator + 1] === ' ' ? 2 : 1))

      if (field === 'event') {
        eventName = value || 'message'
      } else if (field === 'data') {
        dataLines.push(value)
      }
    },
    flush: dispatch,
  }
}

function drainEventStreamLines(buffer: string, parser: EventStreamParser) {
  let start = 0
  for (;;) {
    const newline = buffer.indexOf('\n', start)
    if (newline === -1) break
    const line = buffer.slice(start, newline).replace(TRAILING_CARRIAGE_RETURN_RE, '')
    parser.line(line)
    start = newline + 1
  }
  return buffer.slice(start)
}

function waitForEventStreamRetry(signal: AbortSignal, delayMs: number) {
  if (signal.aborted || delayMs <= 0) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const cleanup = () => {
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
      signal.removeEventListener('abort', cleanup)
      resolve()
    }

    timeout = setTimeout(cleanup, delayMs)
    signal.addEventListener('abort', cleanup, { once: true })
  })
}
