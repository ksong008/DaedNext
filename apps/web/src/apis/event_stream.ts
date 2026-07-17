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

export function subscribeEventStream(options: SubscribeEventStreamOptions) {
  const controller = new AbortController()
  const pageSignal = pageLifecycleSignal()
  const abortFromPage = () => controller.abort(pageSignal.reason)
  if (pageSignal.aborted) {
    abortFromPage()
  } else {
    pageSignal.addEventListener('abort', abortFromPage, { once: true })
  }

  void runEventStreamSubscription(options, controller.signal).finally(() => {
    pageSignal.removeEventListener('abort', abortFromPage)
  })

  return () => {
    pageSignal.removeEventListener('abort', abortFromPage)
    controller.abort()
  }
}

async function runEventStreamSubscription(options: SubscribeEventStreamOptions, signal: AbortSignal) {
  const retryDelayMs = options.retryDelayMs ?? 1500

  while (!signal.aborted) {
    try {
      await readEventStream(options, signal)
      if (!signal.aborted) {
        options.onError?.()
      }
    } catch {
      if (!signal.aborted) {
        options.onError?.()
      }
    }

    if (!signal.aborted) {
      await waitForEventStreamRetry(signal, retryDelayMs)
    }
  }
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
  const decoder = new TextDecoder()
  let buffer = ''
  const state = createEventStreamParser(options.onMessage)

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
