import type { MODE } from '~/constants'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  QUERY_KEY_CONFIG,
  QUERY_KEY_DNS,
  QUERY_KEY_GENERAL,
  QUERY_KEY_GROUP,
  QUERY_KEY_NODE,
  QUERY_KEY_ROUTING,
  QUERY_KEY_STORAGE,
  QUERY_KEY_SUBSCRIPTION,
  QUERY_KEY_USER,
} from '~/constants'
import { useAPIClient } from '~/contexts'

import { toID, toNumericID } from './client'
import type { GlobalInput, ImportArgument, NodeLatencyProbeResult, Policy, PolicyParam } from './types'

type CountResponse = {
  updated?: number
  removed?: number
}

type ResourceWithID = {
  id: number
}

type TokenResponse = {
  token: string
}

type SubscriptionImportResponse = {
  link: string
  nodeImportResult: Array<{
    link: string
    error?: string | null
    node?: { id: number } | null
  }>
  subscription: {
    id: number
  }
}

type NodeImportListResponse = {
  items: Array<{
    link: string
    error?: string | null
    node?: { id: number } | null
  }>
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
      groupName: string
      policy: Policy
      policyParams: PolicyParam[]
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_DNS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROUTING })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_STORAGE })
    },
  })
}

export function useCreateConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, global }: { name?: string; global?: GlobalInput }) => {
      const resource = await apiClient.post<ResourceWithID>('/configs', { name, parsedGlobal: global })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
    },
  })
}

export function useUpdateConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, global }: { id: string; global: GlobalInput }) => {
      const resource = await apiClient.put<ResourceWithID>(`/configs/${id}`, { parsedGlobal: global })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRemoveConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/configs/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
    },
  })
}

export function useSelectConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/configs/${id}/select`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRenameConfigMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/configs/${id}`, { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
    },
  })
}

export function useCreateRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, routing }: { name?: string; routing?: string }) => {
      const resource = await apiClient.post<ResourceWithID>('/routings', { name, routing })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROUTING })
    },
  })
}

export function useUpdateRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, routing }: { id: string; routing: string }) => {
      const resource = await apiClient.put<ResourceWithID>(`/routings/${id}`, { routing })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROUTING })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRemoveRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/routings/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROUTING })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useSelectRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/routings/${id}/select`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROUTING })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRenameRoutingMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/routings/${id}`, { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROUTING })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useCreateDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, dns }: { name?: string; dns?: string }) => {
      const resource = await apiClient.post<ResourceWithID>('/dns', { name, dns })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_DNS })
    },
  })
}

export function useUpdateDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, dns }: { id: string; dns: string }) => {
      const resource = await apiClient.put<ResourceWithID>(`/dns/${id}`, { dns })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_DNS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRemoveDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/dns/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_DNS })
    },
  })
}

export function useSelectDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiClient.post(`/dns/${id}/select`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_DNS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRenameDNSMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/dns/${id}`, { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_DNS })
    },
  })
}

export function useCreateGroupMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, policy, policyParams }: { name: string; policy: Policy; policyParams: PolicyParam[] }) => {
      const resource = await apiClient.post<ResourceWithID>('/groups', { name, policy, policyParams })
      return toID(resource.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
    },
  })
}

export function useRemoveGroupMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/groups/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
    },
  })
}

export function useGroupSetPolicyMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, policy, policyParams }: { id: string; policy: Policy; policyParams: PolicyParam[] }) => {
      await apiClient.put(`/groups/${id}`, { policy, policyParams })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRenameGroupMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiClient.put(`/groups/${id}`, { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useGroupAddNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, nodeIDs }: { id: string; nodeIDs: string[] }) => {
      await apiClient.post(`/groups/${id}/nodes`, { nodeIds: nodeIDs.map(toNumericID) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useGroupDelNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, nodeIDs }: { id: string; nodeIDs: string[] }) => {
      await apiClient.delete(`/groups/${id}/nodes`, { nodeIds: nodeIDs.map(toNumericID) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useGroupAddSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      subscriptionIDs,
      nameFilterRegex,
    }: {
      id: string
      subscriptionIDs: string[]
      nameFilterRegex?: string | null
    }) => {
      await apiClient.post(`/groups/${id}/subscriptions`, {
        subscriptionIds: subscriptionIDs.map(toNumericID),
        nameFilterRegex: nameFilterRegex ?? null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useGroupDelSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, subscriptionIDs }: { id: string; subscriptionIDs: string[] }) => {
      await apiClient.delete(`/groups/${id}/subscriptions`, { subscriptionIds: subscriptionIDs.map(toNumericID) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useImportNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ImportArgument[]) => {
      const result = await apiClient.post<NodeImportListResponse>('/nodes', {
        rollbackError: false,
        args: data,
      })
      return result.items.map((item) => ({
        link: item.link,
        error: item.error ?? null,
        node: item.node ? { id: toID(item.node.id) } : null,
      }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_NODE })
    },
  })
}

export function useRemoveNodesMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await apiClient.delete<{ removed: number }>('/nodes', { ids: ids.map(toNumericID) })
      return result.removed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_NODE })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_CONFIG })
    },
  })
}

export function useUpdateNodeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, newLink }: { id: string; newLink: string }) => {
      const node = await apiClient.put<{ id: number; name: string; tag?: string | null; link: string }>(`/nodes/${id}`, {
        link: newLink,
      })
      return {
        id: toID(node.id),
        name: node.name,
        tag: node.tag ?? null,
        link: node.link,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_NODE })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useImportSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ImportArgument[]) =>
      Promise.all(
        data.map(async (subscription) => {
          const result = await apiClient.post<SubscriptionImportResponse>('/subscriptions', {
            rollbackError: false,
            link: subscription.link,
            tag: subscription.tag ?? null,
          })
          return {
            link: result.link,
            subscription: {
              id: toID(result.subscription.id),
            },
            nodeImportResult: result.nodeImportResult.map((item) => ({
              link: item.link,
              error: item.error ?? null,
              node: item.node ? { id: toID(item.node.id) } : null,
            })),
          }
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_SUBSCRIPTION })
    },
  })
}

export function useUpdateSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(
        ids.map(async (id) => {
          const subscription = await apiClient.post<{ id: number }>(`/subscriptions/${id}/refresh`)
          return toID(subscription.id)
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_SUBSCRIPTION })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useTestNodeLatenciesMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const data = await apiClient.post<{ items: Array<Omit<NodeLatencyProbeResult, 'id'> & { id: number }> }>(
        '/nodes/latencies',
        ids && ids.length > 0 ? { ids: ids.map(toNumericID) } : {},
      )

      return data.items.map((item) => ({
        id: toID(item.id),
        latencyMs: item.latencyMs ?? null,
        alive: item.alive,
        testedAt: item.testedAt,
        message: item.message ?? null,
      }))
    },
  })
}

export function useRemoveSubscriptionsMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await apiClient.delete<{ removed: number }>('/subscriptions', { ids: ids.map(toNumericID) })
      return result.removed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_SUBSCRIPTION })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useRunMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dry: boolean) => {
      const result = await apiClient.post<{ applied: number }>('/runtime/reload', { dry })
      return result.applied
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GENERAL })
    },
  })
}

export function useUpdateAvatarMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (avatar: string) => {
      return apiClient.patch('/user/me', { avatar })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_USER })
    },
  })
}

export function useUpdateNameMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      return apiClient.patch('/user/me', { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_USER })
    },
  })
}

export function useUpdatePasswordMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const response = await apiClient.post<TokenResponse>('/user/me/password', {
        currentPassword,
        newPassword,
      })
      return response.token
    },
  })
}

export function useUpdateUsernameMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (username: string) => {
      return apiClient.patch('/user/me', { username })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_USER })
    },
  })
}

export function useTagNodeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      await apiClient.put(`/nodes/${id}`, { tag })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_NODE })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
    },
  })
}

export function useTagSubscriptionMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      await apiClient.put(`/subscriptions/${id}`, { tag })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_SUBSCRIPTION })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
    },
  })
}

export function useUpdateSubscriptionLinkMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, link }: { id: string; link: string }) => {
      const subscription = await apiClient.put<{ id: number; link: string; tag?: string | null }>(`/subscriptions/${id}`, {
        link,
      })
      return {
        id: toID(subscription.id),
        link: subscription.link,
        tag: subscription.tag ?? null,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_SUBSCRIPTION })
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_GROUP })
    },
  })
}

export function useUpdateSubscriptionCronMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, cronExp, cronEnable }: { id: string; cronExp: string; cronEnable: boolean }) => {
      const subscription = await apiClient.put<{ id: number; cronExp: string; cronEnable: boolean }>(
        `/subscriptions/${id}`,
        { cronExp, cronEnable },
      )
      return {
        id: toID(subscription.id),
        cronExp: subscription.cronExp,
        cronEnable: subscription.cronEnable,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_SUBSCRIPTION })
    },
  })
}
