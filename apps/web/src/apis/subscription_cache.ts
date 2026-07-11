import type { QueryClient } from '@tanstack/react-query'
import { invalidateQueryKeys, webQueryKeys } from './query_cache'

type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>

export function invalidateChangedSubscriptionResources(queryClient: QueryInvalidator) {
  return invalidateQueryKeys(queryClient, [
    webQueryKeys.subscription.summary(),
    webQueryKeys.subscription.expanded(),
    webQueryKeys.node.subscriptionBackedList(),
    webQueryKeys.node.latency(),
    webQueryKeys.group.summary(),
    webQueryKeys.group.expanded(),
    webQueryKeys.general.state(),
  ])
}
