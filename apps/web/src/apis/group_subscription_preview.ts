import type { APIClientInterface } from './client'
import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { isMockMode } from '~/mocks'
import { tokenAtom } from '~/store'
import { toID } from './client'
import { resolveNodeTransport } from './node_transport'
import { webQueryKeys } from './query_cache'

const GROUP_SUBSCRIPTION_FILTER_PREVIEW_PATH = '/groups/subscription-preview'
const GROUP_SUBSCRIPTION_FILTER_PREVIEW_DEBOUNCE_MS = 300
const GROUP_SUBSCRIPTION_FILTER_PREVIEW_CACHE_TIME_MS = 30_000

interface GroupSubscriptionFilterPreviewNodeAPI {
  id: number
  link: string
  name: string
  protocol: string
  transport?: string | null
}

interface GroupSubscriptionFilterPreviewAPI {
  matchedCount: number
  items: Array<{
    subscriptionId: number
    matchedCount: number
    sampleMatchedNodes: GroupSubscriptionFilterPreviewNodeAPI[]
    sampleTruncated: boolean
  }>
}

export interface GroupSubscriptionFilterPreview {
  matchedCount: number
  items: Array<{
    subscriptionID: string
    matchedCount: number
    sampleMatchedNodes: Array<{
      id: string
      title: string
      protocol: string
      transport?: string
    }>
    sampleTruncated: boolean
  }>
}

export async function requestGroupSubscriptionFilterPreview(
  apiClient: APIClientInterface,
  subscriptionIDs: string[],
  nameFilterRegex: string,
  signal: AbortSignal,
): Promise<GroupSubscriptionFilterPreview> {
  const data = await apiClient.post<GroupSubscriptionFilterPreviewAPI>(
    GROUP_SUBSCRIPTION_FILTER_PREVIEW_PATH,
    {
      subscriptionIds: subscriptionIDs,
      nameFilterRegex: nameFilterRegex || null,
    },
    undefined,
    { signal },
  )
  return {
    matchedCount: data.matchedCount,
    items: data.items.map((item) => ({
      subscriptionID: toID(item.subscriptionId),
      matchedCount: item.matchedCount,
      sampleMatchedNodes: item.sampleMatchedNodes.map((node) => ({
        id: toID(node.id),
        title: node.name,
        protocol: node.protocol,
        transport: resolveNodeTransport(node.link, node.protocol, node.transport) ?? undefined,
      })),
      sampleTruncated: item.sampleTruncated,
    })),
  }
}

export function waitForGroupSubscriptionFilterPreviewDebounce(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortReason(signal))

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    const abort = () => {
      clearTimeout(timer)
      reject(abortReason(signal))
    }
    const finish = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    timer = setTimeout(finish, GROUP_SUBSCRIPTION_FILTER_PREVIEW_DEBOUNCE_MS)
    signal.addEventListener('abort', abort, { once: true })
  })
}

function abortReason(signal: AbortSignal) {
  return signal.reason ?? new Error('group subscription preview aborted')
}

export function useGroupSubscriptionFilterPreviewQuery(
  subscriptionIDs: string[],
  nameFilterRegex: string,
  enabled = true,
) {
  const apiClient = useAPIClient()
  const token = useStore(tokenAtom)
  const queryEnabled = enabled && subscriptionIDs.length > 0 && (isMockMode() || !!token)

  return useQuery({
    queryKey: webQueryKeys.group.subscriptionPreview(subscriptionIDs, nameFilterRegex),
    queryFn: async ({ signal }) => {
      await waitForGroupSubscriptionFilterPreviewDebounce(signal)
      return requestGroupSubscriptionFilterPreview(apiClient, subscriptionIDs, nameFilterRegex, signal)
    },
    enabled: queryEnabled,
    retry: false,
    gcTime: GROUP_SUBSCRIPTION_FILTER_PREVIEW_CACHE_TIME_MS,
  })
}
