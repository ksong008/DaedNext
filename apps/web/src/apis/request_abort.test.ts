import { afterEach, describe, expect, it, vi } from 'vitest'

import { APIRequestTimeoutError, createAPIRequestAbortScope } from './request_abort'

afterEach(() => {
  vi.useRealTimers()
})

describe('request abort scope', () => {
  it('propagates caller cancellation', () => {
    const caller = new AbortController()
    const scope = createAPIRequestAbortScope({ signal: caller.signal, timeoutMs: 1_000 })

    caller.abort(new Error('navigation cancelled'))

    expect(scope.signal.aborted).toBe(true)
    expect(scope.signal.reason).toEqual(new Error('navigation cancelled'))
    scope.dispose()
  })

  it('aborts a request when its deadline expires', async () => {
    vi.useFakeTimers()
    const scope = createAPIRequestAbortScope({ timeoutMs: 25 })

    await vi.advanceTimersByTimeAsync(25)

    expect(scope.signal.aborted).toBe(true)
    expect(scope.signal.reason).toBeInstanceOf(APIRequestTimeoutError)
    scope.dispose()
  })

  it('removes the caller listener and deadline after disposal', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    const scope = createAPIRequestAbortScope({ signal: caller.signal, timeoutMs: 25 })

    scope.dispose()
    caller.abort()
    await vi.advanceTimersByTimeAsync(25)

    expect(scope.signal.aborted).toBe(false)
  })

  it('propagates a page lifecycle signal independently of a caller signal', () => {
    const page = new AbortController()
    const caller = new AbortController()
    const scope = createAPIRequestAbortScope({ signal: caller.signal }, [page.signal])

    page.abort(new Error('page closed'))

    expect(scope.signal.aborted).toBe(true)
    expect(scope.signal.reason).toEqual(new Error('page closed'))
    scope.dispose()
  })
})
