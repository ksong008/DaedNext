import type { LogEntry, LogSettings } from '../types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { buildEventStreamURL } from '../event_stream'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { useAuthenticatedQueryEnabled } from './shared'

export function buildLogEventsURL(endpointURL: string, level: string, query: string, afterId?: number | null) {
  return buildEventStreamURL(endpointURL, '/events/logs', {
    level,
    q: query,
    after_id: afterId && afterId > 0 ? afterId : undefined,
  }).toString()
}

export function useLogsQuery({ level, query, limit = 500 }: { level: string; query: string; limit?: number }) {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: [...webQueryKeys.log.items(), level, query, limit],
    queryFn: async ({ signal }): Promise<{ items: LogEntry[] }> => {
      return apiClient.get<{ items: LogEntry[] }>('/logs', { level, q: query, limit }, { signal })
    },
    enabled,
  })
}

export function useLogSettingsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.log.settings(),
    queryFn: async ({ signal }): Promise<LogSettings> => {
      return apiClient.get<LogSettings>('/logs/settings', undefined, { signal })
    },
    enabled,
  })
}

export function useRuntimeLogLevelQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.log.runtimeLevel(),
    queryFn: async ({ signal }): Promise<{ level: string }> => {
      return apiClient.get<{ level: string }>('/runtime/log-level', undefined, { signal })
    },
    enabled,
  })
}

export function useSetRuntimeLogLevelMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (level: string) => {
      return apiClient.patch<{ level: string }>('/runtime/log-level', { level })
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.log.runtimeLevel(), webQueryKeys.log.items()])
    },
  })
}

export function useClearLogsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiClient.delete<{ cleared: boolean }>('/logs')
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.log.items()])
    },
  })
}

export function useUpdateLogSettingsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Pick<LogSettings, 'maxEntries' | 'maxBytes'>) => {
      return apiClient.patch<LogSettings>('/logs/settings', settings)
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.log.settings()])
    },
  })
}
