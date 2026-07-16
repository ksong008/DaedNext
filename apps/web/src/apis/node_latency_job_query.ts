import type { APIClientInterface } from './client'
import type { NodeLatencyJob, NodeLatencyJobView } from './types'

import { queryOptions } from '@tanstack/react-query'

import { nodeLatencyJobRefetchInterval } from './node_latency_job'
import { webQueryKeys } from './query_cache'

interface NodeLatencyJobAPI {
  id: number
  status: string
  total: number
  completed: number
  succeeded: number
  failed: number
  queuedAt: string
  startedAt?: string | null
  finishedAt?: string | null
  message?: string | null
}

export function adaptNodeLatencyJob(job?: NodeLatencyJobAPI | null): NodeLatencyJob | null {
  if (!job) return null
  return {
    id: String(job.id),
    status: job.status,
    total: job.total,
    completed: job.completed,
    succeeded: job.succeeded,
    failed: job.failed,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    message: job.message ?? null,
  }
}

export function nodeLatencyJobQueryOptions(apiClient: APIClientInterface, refetchIntervalMs: number) {
  return queryOptions({
    queryKey: webQueryKeys.node.latencyJob(),
    queryFn: async ({ signal }): Promise<NodeLatencyJobView> => {
      const data = await apiClient.get<{ job?: NodeLatencyJobAPI | null }>('/nodes/latencies/job', undefined, {
        signal,
      })
      return { job: adaptNodeLatencyJob(data.job) }
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: (query) => nodeLatencyJobRefetchInterval(query.state.data?.job, refetchIntervalMs),
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  })
}
