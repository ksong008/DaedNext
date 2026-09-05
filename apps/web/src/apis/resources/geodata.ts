import type {
  GeodataKind,
  GeodataSettingsView,
  GeodataSourceResource,
  GeodataUpdateResult,
  GeodataView,
} from '../types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { useAuthenticatedQueryEnabled } from './shared'

export interface GeodataResourceAPI {
  available: boolean
  version: string
  categoryCount: number
  ruleCount?: number
  cidrCount?: number
  fileSize?: number
  sha256?: string | null
  updatedAt?: string | null
  lastError?: string | null
}

export interface GeodataAPI {
  geosite: GeodataResourceAPI
  geoip: GeodataResourceAPI
  updated?: 'geosite' | 'geoip'
  runtimeReloadRequired?: boolean
  runtimeReloaded?: boolean
  runtimeReloadSource?: string
  runtimeReloadElapsed?: string
  runtimeReloadStatus?: unknown
  runtimeReloadMessage?: string
}

export interface GeodataSourceAPI {
  kind: GeodataKind
  url: string
  defaultUrl: string
  usingDefault: boolean
  sourceType?: 'release' | 'direct'
  useProxy?: boolean
}

export interface GeodataSettingsAPI {
  geosite: GeodataSourceAPI
  geoip: GeodataSourceAPI
}

export function useGeodataQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.geodata.status(),
    queryFn: async ({ signal }): Promise<GeodataView> => apiClient.get<GeodataAPI>('/geodata', undefined, { signal }),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useGeodataSettingsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.geodata.settings(),
    queryFn: async ({ signal }): Promise<GeodataSettingsView> =>
      apiClient.get<GeodataSettingsAPI>('/geodata/settings', undefined, { signal }),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useUpdateGeodataMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (kind: GeodataKind) => apiClient.post<GeodataUpdateResult>(`/geodata/${kind}/update`),
    onSuccess: (result) => {
      const updatedResource = result[result.updated]
      if (updatedResource) {
        queryClient.setQueryData<GeodataView | undefined>(webQueryKeys.geodata.status(), (current) =>
          current ? { ...current, [result.updated]: updatedResource } : current,
        )
      } else {
        void invalidateQueryKeys(queryClient, [webQueryKeys.geodata.status()])
      }
      void invalidateQueryKeys(queryClient, [webQueryKeys.general.state()])
    },
  })
}

export function useUpdateGeodataSourceMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      kind,
      url,
      restoreDefault,
      useProxy,
    }: {
      kind: GeodataKind
      url?: string
      restoreDefault?: boolean
      useProxy?: boolean
    }) =>
      apiClient.patch<GeodataSourceResource>(
        `/geodata/${kind}/settings`,
        restoreDefault ? { restoreDefault: true, useProxy } : { url: url ?? '', useProxy },
      ),
    onSuccess: (source) => {
      queryClient.setQueryData<GeodataSettingsView | undefined>(webQueryKeys.geodata.settings(), (current) =>
        current ? { ...current, [source.kind]: source } : current,
      )
    },
  })
}
