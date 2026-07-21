import type { APIClientInterface } from './client'
import type { ImportArgument } from './types'

import { mapWithConcurrency } from './bounded_concurrency'
import { toID } from './client'

export const SUBSCRIPTION_BULK_REQUEST_CONCURRENCY = 4

interface SubscriptionImportResponse {
  link: string
  error?: string | null
  subscriptionCreated: boolean
  importedNodeCount: number
  failedNodeCount: number
  partialFailure: boolean
  nodeImportResult: Array<{
    link: string
    error?: string | null
    node?: { id: number } | null
  }>
  subscription: {
    id: number
  }
}

export class DuplicateSubscriptionTagError extends Error {
  constructor() {
    super('each subscription tag must be unique within one import')
    this.name = 'DuplicateSubscriptionTagError'
  }
}

function assertUniqueSubscriptionTags(subscriptions: readonly ImportArgument[]) {
  const tags = new Set<string>()
  for (const subscription of subscriptions) {
    const tag = subscription.tag
    if (!tag) continue
    if (tags.has(tag)) {
      throw new DuplicateSubscriptionTagError()
    }
    tags.add(tag)
  }
}

export function importSubscriptions(
  apiClient: Pick<APIClientInterface, 'post'>,
  subscriptions: readonly ImportArgument[],
) {
  assertUniqueSubscriptionTags(subscriptions)
  return mapWithConcurrency(subscriptions, SUBSCRIPTION_BULK_REQUEST_CONCURRENCY, async (subscription) => {
    const result = await apiClient.post<SubscriptionImportResponse>('/subscriptions', {
      rollbackError: false,
      link: subscription.link,
      tag: subscription.tag ?? null,
      useProxy: subscription.useProxy ?? false,
    })
    return {
      link: result.link,
      error: result.error ?? null,
      subscriptionCreated: result.subscriptionCreated,
      importedNodeCount: result.importedNodeCount,
      failedNodeCount: result.failedNodeCount,
      partialFailure: result.partialFailure,
      subscription: {
        id: toID(result.subscription.id),
      },
      nodeImportResult: result.nodeImportResult.map((item) => ({
        link: item.link,
        error: item.error ?? null,
        node: item.node ? { id: toID(item.node.id) } : null,
      })),
    }
  })
}
