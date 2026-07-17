export const DEFAULT_API_REQUEST_TIMEOUT_MS = 120_000

export interface APIRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  suppressErrorToast?: boolean
}

export interface APIRequestAbortScope {
  signal: AbortSignal
  dispose: () => void
}

export class APIRequestTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`API request timed out after ${timeoutMs} ms`)
    this.name = 'APIRequestTimeoutError'
  }
}

export function createAPIRequestAbortScope(
  options: APIRequestOptions = {},
  inheritedSignals: readonly AbortSignal[] = [],
): APIRequestAbortScope {
  const controller = new AbortController()
  const signals = [...inheritedSignals, ...(options.signal ? [options.signal] : [])]
  const timeoutMs = options.timeoutMs
  let timeout: ReturnType<typeof setTimeout> | null = null

  const abortFromSignal = (signal: AbortSignal) => {
    controller.abort(signal.reason)
  }

  const listeners = signals.map((signal) => {
    const listener = () => abortFromSignal(signal)
    if (signal.aborted) {
      abortFromSignal(signal)
    } else if (!controller.signal.aborted) {
      signal.addEventListener('abort', listener, { once: true })
    }
    return { signal, listener }
  })

  if (controller.signal.aborted) {
    for (const { signal, listener } of listeners) {
      signal.removeEventListener('abort', listener)
    }
  }

  if (!controller.signal.aborted && timeoutMs != null && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeout = setTimeout(() => {
      controller.abort(new APIRequestTimeoutError(timeoutMs))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    dispose() {
      for (const { signal, listener } of listeners) {
        signal.removeEventListener('abort', listener)
      }
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
    },
  }
}
