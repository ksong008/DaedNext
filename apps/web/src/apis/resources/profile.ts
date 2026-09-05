import type { QueryClient } from '@tanstack/react-query'
import type { APIClientInterface } from '../client'
import type { UserProfileUpdate } from '../resource_updates'
import type {
  DAEBundle,
  DAEConfigFileExportResult,
  DAEConfigFileImportResult,
  DAEConfigFilePreviewResult,
  GlobalInput,
  Policy,
  PolicyParam,
} from '../types'
import type { CountResponse } from './shared'
import type { MODE } from '~/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { flushGroupSortStateWrites } from '../group_sort_storage'
import { selectProfileResources } from '../profile_selection'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { updateUserProfile } from '../resource_updates'
import { useAuthenticatedQueryEnabled } from './shared'

export interface JSONStorageResponse {
  values: string[]
}

export function getModeRequest(apiClient: APIClientInterface) {
  return async (signal?: AbortSignal) => {
    const { values } = await apiClient.get<JSONStorageResponse>('/user/me/storage', { path: ['mode'] }, { signal })
    return values[0]
  }
}

export function getDefaultsRequest(apiClient: APIClientInterface) {
  return async (signal?: AbortSignal) => {
    const { values } = await apiClient.get<JSONStorageResponse>(
      '/user/me/storage',
      {
        path: ['defaultConfigID', 'defaultRoutingID', 'defaultDNSID', 'defaultGroupID'],
      },
      { signal },
    )
    const [defaultConfigID, defaultRoutingID, defaultDNSID, defaultGroupID] = values
    return {
      defaultConfigID,
      defaultRoutingID,
      defaultDNSID,
      defaultGroupID,
    }
  }
}

export function useDefaultsQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  const { data } = useQuery({
    queryKey: webQueryKeys.storage(),
    queryFn: ({ signal }) => getDefaultsRequest(apiClient)(signal),
    enabled,
  })

  if (!data) {
    return
  }

  return data
}

export function invalidateDefaultResourceSetup(queryClient: QueryClient) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.config.summary(),
    webQueryKeys.config.expanded(),
    webQueryKeys.dns.summary(),
    webQueryKeys.dns.expanded(),
    webQueryKeys.routing.summary(),
    webQueryKeys.routing.expanded(),
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    webQueryKeys.general.state(),
    webQueryKeys.storage(),
  ])
}

export function invalidateImportedProductGraph(queryClient: QueryClient) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.config.summary(),
    webQueryKeys.config.expanded(),
    webQueryKeys.config.item(),
    webQueryKeys.dns.summary(),
    webQueryKeys.dns.expanded(),
    webQueryKeys.routing.summary(),
    webQueryKeys.routing.expanded(),
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    webQueryKeys.node.list(),
    webQueryKeys.subscription.summary(),
    webQueryKeys.subscription.expanded(),
    webQueryKeys.general.state(),
    webQueryKeys.storage(),
    webQueryKeys.user(),
  ])
}

export function useSetJsonStorageMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (object: Record<string, string>) => {
      const paths = Object.keys(object)
      const values = paths.map((path) => object[path])
      const response = await apiClient.put<CountResponse>('/user/me/storage', { paths, values })
      return response.updated ?? 0
    },
  })
}

export function useSetModeMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (mode: MODE) => {
      const response = await apiClient.put<CountResponse>('/user/me/storage', {
        paths: ['mode'],
        values: [mode],
      })
      return response.updated ?? 0
    },
  })
}

export function useEnsureDefaultResourcesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      configName,
      global,
      dnsName,
      dns,
      routingName,
      routing,
      groupName,
      policy,
      policyParams,
      mode,
    }: {
      configName: string
      global: GlobalInput
      dnsName: string
      dns: string
      routingName: string
      routing: string
      groupName?: string
      policy?: Policy
      policyParams?: PolicyParam[]
      mode: string
    }) => {
      const ensured = await apiClient.post<{
        defaultConfigID: string
        defaultRoutingID: string
        defaultDNSID: string
        defaultGroupID: string
        mode: string
      }>('/user/me/default-resources', {
        configName,
        global,
        dnsName,
        dns,
        routingName,
        routing,
        groupName,
        policy,
        policyParams,
        mode,
      })

      return ensured
    },
    onSuccess: () => {
      void invalidateDefaultResourceSetup(queryClient)
    },
  })
}

export function useExportDAEBundleMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (): Promise<DAEBundle> => {
      await flushGroupSortStateWrites()
      return apiClient.get<DAEBundle>('/user/me/dae-bundle')
    },
  })
}

export function useImportDAEBundleMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bundle: DAEBundle) => {
      await flushGroupSortStateWrites()
      return apiClient.put<{ imported: boolean }>('/user/me/dae-bundle', bundle)
    },
    onSuccess: () => {
      void invalidateImportedProductGraph(queryClient)
    },
  })
}

export function useExportDAEConfigFileMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (): Promise<DAEConfigFileExportResult> => {
      return apiClient.get<DAEConfigFileExportResult>('/user/me/dae-config-file')
    },
  })
}

export function useImportDAEConfigFileMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      filename,
      namePrefix,
      content,
    }: {
      filename?: string
      namePrefix?: string
      content: string
    }) => {
      return apiClient.put<DAEConfigFileImportResult>('/user/me/dae-config-file', { filename, namePrefix, content })
    },
    onSuccess: () => {
      void invalidateImportedProductGraph(queryClient)
    },
  })
}

export function usePreviewDAEConfigFileMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({
      filename,
      namePrefix,
      content,
    }: {
      filename?: string
      namePrefix?: string
      content: string
    }) => {
      return apiClient.post<DAEConfigFilePreviewResult>('/user/me/dae-config-file/preview', {
        filename,
        namePrefix,
        content,
      })
    },
  })
}

export function useSelectProfileMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (selection: { configID: string; dnsID: string; routingID: string }) =>
      selectProfileResources(apiClient, selection),
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [
        webQueryKeys.config.summary(),
        webQueryKeys.config.expanded(),
        webQueryKeys.config.item(),
        webQueryKeys.dns.summary(),
        webQueryKeys.dns.expanded(),
        webQueryKeys.routing.summary(),
        webQueryKeys.routing.expanded(),
        webQueryKeys.general.state(),
      ])
    },
  })
}

export function useUpdateUserProfileMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (update: UserProfileUpdate) => updateUserProfile(apiClient, update),
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.user()])
    },
  })
}
