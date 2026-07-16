import type { QueryClient } from '@tanstack/react-query'

import type { NodeLatencyJob, NodeLatencyJobView } from './types'

import { webQueryKeys } from './query_cache'

const ACTIVE_NODE_LATENCY_JOB_STATUSES = new Set(['queued', 'running', 'cancelling'])

export function isNodeLatencyJobActive(job?: NodeLatencyJob | null) {
  return !!job && ACTIVE_NODE_LATENCY_JOB_STATUSES.has(job.status)
}

export function nodeLatencyJobRefetchInterval(job: NodeLatencyJob | null | undefined, intervalMs: number) {
  return isNodeLatencyJobActive(job) ? intervalMs : false
}

export function setCachedNodeLatencyJob(queryClient: QueryClient, job: NodeLatencyJob | null) {
  queryClient.setQueryData<NodeLatencyJobView>(webQueryKeys.node.latencyJob(), { job })
}
