import type { APIClientInterface } from './client'
import type { NodeLatencyJob, NodeLatencyJobView } from './types'

import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { isNodeLatencyJobActive, nodeLatencyJobRefetchInterval, setCachedNodeLatencyJob } from './node_latency_job'
import { nodeLatencyJobQueryOptions } from './node_latency_job_query'
import { webQueryKeys } from './query_cache'

const POLL_INTERVAL_MS = 60_000

function job(status: string, { id = '7', completed = 0, total = 10 } = {}): NodeLatencyJob {
  const value: NodeLatencyJob = {
    id,
    status,
    total,
    completed,
    succeeded: completed,
    failed: 0,
    queuedAt: '2026-07-16T00:00:00Z',
    finishedAt: null,
  }
  if (!isNodeLatencyJobActive(value)) value.finishedAt = '2026-07-16T00:00:01Z'
  return value
}

function apiJob(value: NodeLatencyJob) {
  return {
    ...value,
    id: Number(value.id),
  }
}

function apiClientWithJobs(...jobs: NodeLatencyJob[]) {
  const get = vi.fn()
  for (const value of jobs) {
    get.mockResolvedValueOnce({ job: apiJob(value) })
  }
  return {
    apiClient: { get } as unknown as APIClientInterface,
    get,
  }
}

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

describe('node latency job cache lifecycle', () => {
  it('uses one centralized active-state contract for polling', () => {
    for (const status of ['queued', 'running', 'cancelling']) {
      expect(isNodeLatencyJobActive(job(status))).toBe(true)
      expect(nodeLatencyJobRefetchInterval(job(status), 500)).toBe(500)
    }
    for (const status of ['finished', 'failed', 'cancelled']) {
      expect(isNodeLatencyJobActive(job(status))).toBe(false)
      expect(nodeLatencyJobRefetchInterval(job(status), 500)).toBe(false)
    }
    expect(nodeLatencyJobRefetchInterval(null, 500)).toBe(false)
  })

  it('lets admitted and cancelled server jobs replace stale cached state', () => {
    const client = queryClient()
    setCachedNodeLatencyJob(client, job('finished', { id: '6', completed: 10 }))

    setCachedNodeLatencyJob(client, job('running'))
    expect(client.getQueryData<NodeLatencyJobView>(webQueryKeys.node.latencyJob())?.job).toMatchObject({
      id: '7',
      status: 'running',
      completed: 0,
    })

    setCachedNodeLatencyJob(client, job('cancelling', { completed: 4 }))
    expect(client.getQueryData<NodeLatencyJobView>(webQueryKeys.node.latencyJob())?.job).toMatchObject({
      status: 'cancelling',
      completed: 4,
    })

    setCachedNodeLatencyJob(client, null)
    expect(client.getQueryData<NodeLatencyJobView>(webQueryKeys.node.latencyJob())).toEqual({ job: null })
    client.clear()
  })

  it('keeps an immediate authoritative terminal response over an admitted active response', async () => {
    const activeJob = job('running')
    const terminalJob = job('finished', { completed: 10 })
    const { apiClient, get } = apiClientWithJobs(terminalJob)
    const client = queryClient()
    const options = nodeLatencyJobQueryOptions(apiClient, POLL_INTERVAL_MS)

    setCachedNodeLatencyJob(client, activeJob)
    await client.fetchQuery(options)

    expect(get).toHaveBeenCalledTimes(1)
    expect(client.getQueryData<NodeLatencyJobView>(webQueryKeys.node.latencyJob())?.job).toMatchObject({
      id: '7',
      status: 'finished',
      completed: 10,
    })
    client.clear()
  })

  it('refetches canonical state when a cached terminal query is remounted', async () => {
    const activeJob = job('running', { completed: 3 })
    const terminalJob = job('finished', { completed: 10 })
    const { apiClient, get } = apiClientWithJobs(activeJob, terminalJob)
    const client = queryClient()
    const options = nodeLatencyJobQueryOptions(apiClient, POLL_INTERVAL_MS)
    setCachedNodeLatencyJob(client, job('finished', { id: '6', completed: 10 }))

    const firstObserver = new QueryObserver(client, options)
    const unsubscribeFirst = firstObserver.subscribe(() => undefined)
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(firstObserver.getCurrentResult().data?.job?.status).toBe('running'))
    unsubscribeFirst()

    const secondObserver = new QueryObserver(client, options)
    const unsubscribeSecond = secondObserver.subscribe(() => undefined)
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(secondObserver.getCurrentResult().data?.job?.status).toBe('finished'))
    unsubscribeSecond()
    client.clear()
  })

  it('recovers an active job with a replacement QueryClient', async () => {
    const activeJob = job('running', { id: '9', completed: 2 })
    const { apiClient, get } = apiClientWithJobs(activeJob)
    const client = queryClient()
    const observer = new QueryObserver(client, nodeLatencyJobQueryOptions(apiClient, POLL_INTERVAL_MS))
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.job).toMatchObject({ id: '9', status: 'running', completed: 2 }),
    )

    unsubscribe()
    client.clear()
  })

  it('authoritatively refetches an active job when connectivity returns', async () => {
    const activeJob = job('running', { completed: 2 })
    const terminalJob = job('finished', { completed: 10 })
    const { apiClient, get } = apiClientWithJobs(activeJob, terminalJob)
    const client = queryClient()
    client.mount()
    const observer = new QueryObserver(client, nodeLatencyJobQueryOptions(apiClient, POLL_INTERVAL_MS))
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.job?.status).toBe('running'))
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.job?.status).toBe('finished'))

    unsubscribe()
    client.unmount()
    client.clear()
  })

  it('publishes visible progress and retains the terminal cache without another polling interval', () => {
    const client = queryClient()
    const seen: Array<string> = []
    const { apiClient } = apiClientWithJobs()
    const observer = new QueryObserver(client, {
      ...nodeLatencyJobQueryOptions(apiClient, POLL_INTERVAL_MS),
      enabled: false,
    })
    const unsubscribe = observer.subscribe((result) => {
      const currentJob = result.data?.job
      if (currentJob) seen.push(`${currentJob.status}:${currentJob.completed}`)
    })

    setCachedNodeLatencyJob(client, job('running'))
    setCachedNodeLatencyJob(client, job('running', { completed: 4 }))
    setCachedNodeLatencyJob(client, job('finished', { completed: 10 }))

    expect(seen).toEqual(['running:0', 'running:4', 'finished:10'])
    expect(nodeLatencyJobRefetchInterval(observer.getCurrentResult().data?.job, POLL_INTERVAL_MS)).toBe(false)
    unsubscribe()
    client.clear()
  })
})
