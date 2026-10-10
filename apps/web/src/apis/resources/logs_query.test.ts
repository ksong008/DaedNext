import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APIClient } from '../client'
import { logQueryOptions } from './logs_query'

const { errorToast } = vi.hoisted(() => {
  vi.stubGlobal('location', { protocol: 'http:', hostname: '127.0.0.1' })
  return { errorToast: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { error: errorToast } }))

const clients: QueryClient[] = []
function fixture(responses: number[]) {
  vi.useFakeTimers()
  vi.stubGlobal('location', { protocol: 'http:', hostname: '127.0.0.1' })
  const fetchMock = vi.fn(async () => {
    const status = responses.shift() ?? 503
    return new Response(
      JSON.stringify(
        status === 200
          ? { items: [] }
          : {
              error: 'log query failed',
              errorCode: status === 503 ? 'log_snapshot_unstable' : null,
              retryable: status === 503,
            },
      ),
      { status, headers: { 'content-type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  clients.push(queryClient)
  const options = logQueryOptions(new APIClient('http://127.0.0.1/api'), { level: 'all', query: '' })
  return { queryClient, options, fetchMock }
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('log query recovery', () => {
  it('recovers after snapshot contention without error toasts', async () => {
    const { queryClient, options, fetchMock } = fixture([503, 503, 200])
    const request = queryClient.fetchQuery(options)
    await vi.advanceTimersByTimeAsync(3100)
    await expect(request).resolves.toEqual({ items: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(errorToast).not.toHaveBeenCalled()
  })

  it('stops after three delayed retries and retains the typed error', async () => {
    const { queryClient, options, fetchMock } = fixture([])
    const outcome = queryClient.fetchQuery(options).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(7100)
    expect(await outcome).toMatchObject({ status: 503, errorCode: 'log_snapshot_unstable', retryable: true })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(errorToast).not.toHaveBeenCalled()
  })

  it('reports a permanent server error without contention retries', async () => {
    const { queryClient, options, fetchMock } = fixture([500])
    const outcome = queryClient.fetchQuery(options).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(100)
    expect(await outcome).toMatchObject({ status: 500, retryable: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancels pending retries when the query is cancelled', async () => {
    const { queryClient, options, fetchMock } = fixture([])
    const outcome = queryClient.fetchQuery(options).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await queryClient.cancelQueries({ queryKey: options.queryKey })
    await outcome
    await vi.advanceTimersByTimeAsync(10000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
