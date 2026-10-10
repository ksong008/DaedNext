import type { APIClientInterface } from '../client'
import type { LogEntry } from '../types'
import { queryOptions } from '@tanstack/react-query'
import { APIResponseError } from '../client'
import { webQueryKeys } from '../query_cache'

export function isLogSnapshotUnstable(error: unknown) {
  return (
    error instanceof APIResponseError &&
    error.status === 503 &&
    error.errorCode === 'log_snapshot_unstable' &&
    error.retryable
  )
}

export function logQueryOptions(
  apiClient: APIClientInterface,
  { level, query, limit = 500 }: { level: string; query: string; limit?: number },
) {
  return queryOptions({
    queryKey: [...webQueryKeys.log.items(), level, query, limit],
    queryFn: ({ signal }): Promise<{ items: LogEntry[] }> => {
      return apiClient.get<{ items: LogEntry[] }>(
        '/logs',
        { level, q: query, limit },
        { signal, suppressErrorToast: true },
      )
    },
    retry: (failureCount, error) => isLogSnapshotUnstable(error) && failureCount < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  })
}
