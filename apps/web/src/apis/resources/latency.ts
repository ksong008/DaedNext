import type { NodeLatencyProbeResponse, NodeLatencyProbeResult } from '../types'
import type { NodeLatencyAPI } from './latency_result'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { toNumericID } from '../client'
import { setCachedNodeLatencyJob } from '../node_latency_job'
import { adaptNodeLatencyJob, nodeLatencyJobQueryOptions } from '../node_latency_job_query'
import { webQueryKeys } from '../query_cache'
import { adaptNodeLatencyProbeResults } from './latency_result'
import { useAuthenticatedQueryEnabled } from './shared'

export function useNodeLatenciesQuery(refetchIntervalMs: number, enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    queryKey: webQueryKeys.node.latency(),
    queryFn: async ({ signal }): Promise<NodeLatencyProbeResult[]> => {
      const data = await apiClient.get<{ items: NodeLatencyAPI[] }>('/nodes/latencies', undefined, { signal })
      return adaptNodeLatencyProbeResults(data.items)
    },
    enabled: queryEnabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: () => refetchIntervalMs,
    refetchIntervalInBackground: false,
  })
}

export function useNodeLatencyJobQuery(refetchIntervalMs: number, enabled = true) {
  const apiClient = useAPIClient()
  const queryEnabled = useAuthenticatedQueryEnabled(enabled)

  return useQuery({
    ...nodeLatencyJobQueryOptions(apiClient, refetchIntervalMs),
    enabled: queryEnabled,
  })
}

export function useTestNodeLatenciesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      ids,
      signal,
      timeoutMs,
    }: { ids?: string[]; signal?: AbortSignal; timeoutMs?: number } = {}) => {
      const data = await apiClient.post<{
        items: Parameters<typeof adaptNodeLatencyProbeResults>[0]
        admission: NodeLatencyProbeResponse['admission']
        job?: Parameters<typeof adaptNodeLatencyJob>[0]
      }>('/nodes/latencies', ids && ids.length > 0 ? { ids: ids.map(toNumericID) } : {}, undefined, {
        signal,
        timeoutMs,
        suppressErrorToast: true,
      })

      if (data.admission !== 'started' && data.admission !== 'existing') {
        throw new Error('invalid manual latency admission response')
      }

      const job = adaptNodeLatencyJob(data.job)
      if (!job) {
        throw new Error('manual latency admission did not return a job')
      }

      return {
        items: adaptNodeLatencyProbeResults(data.items),
        admission: data.admission,
        job,
      } satisfies NodeLatencyProbeResponse
    },
    onSuccess: (response) => {
      setCachedNodeLatencyJob(queryClient, response.job)
    },
  })
}

export function useCancelNodeLatencyJobMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const data = await apiClient.delete<{
        job?: Parameters<typeof adaptNodeLatencyJob>[0]
      }>('/nodes/latencies/job', { id: toNumericID(jobId) })
      return adaptNodeLatencyJob(data.job)
    },
    onSuccess: (job) => {
      setCachedNodeLatencyJob(queryClient, job)
    },
  })
}
