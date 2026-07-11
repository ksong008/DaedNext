export const DEFAULT_API_REQUEST_TIMEOUT_MS = 120_000

export interface APIRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
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

export function createAPIRequestAbortScope(options: APIRequestOptions = {}): APIRequestAbortScope {
  const controller = new AbortController()
  const callerSignal = options.signal
  const timeoutMs = options.timeoutMs
  let timeout: ReturnType<typeof setTimeout> | null = null

  const abortFromCaller = () => {
    controller.abort(callerSignal?.reason)
  }

  if (callerSignal?.aborted) {
    abortFromCaller()
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  }

  if (!controller.signal.aborted && timeoutMs != null && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeout = setTimeout(() => {
      controller.abort(new APIRequestTimeoutError(timeoutMs))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    dispose() {
      callerSignal?.removeEventListener('abort', abortFromCaller)
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
    },
  }
}
