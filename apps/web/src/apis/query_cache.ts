import type { QueryClient, QueryKey } from '@tanstack/react-query'

import {
  QUERY_KEY_CONFIG,
  QUERY_KEY_DNS,
  QUERY_KEY_GENERAL,
  QUERY_KEY_GENERAL_INTERFACES,
  QUERY_KEY_GENERAL_STATE,
  QUERY_KEY_GEODATA,
  QUERY_KEY_GROUP,
  QUERY_KEY_LOG,
  QUERY_KEY_NODE,
  QUERY_KEY_NODE_LATENCY,
  QUERY_KEY_NODE_LATENCY_JOB,
  QUERY_KEY_ROUTING,
  QUERY_KEY_STORAGE,
  QUERY_KEY_SUBSCRIPTION,
  QUERY_KEY_TRAFFIC,
  QUERY_KEY_USER,
} from '~/constants/misc'

type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>

function rootKey(queryKey: readonly unknown[]): QueryKey {
  return [...queryKey]
}

function childKey(queryKey: readonly unknown[], ...parts: unknown[]): QueryKey {
  return [...queryKey, ...parts]
}

export const webQueryKeys = {
  config: {
    root: () => rootKey(QUERY_KEY_CONFIG),
    summary: () => childKey(QUERY_KEY_CONFIG, 'summary'),
    expanded: () => childKey(QUERY_KEY_CONFIG, 'expanded'),
    item: (id?: string | null) => childKey(QUERY_KEY_CONFIG, 'item', ...(id ? [id] : [])),
  },
  dns: {
    root: () => rootKey(QUERY_KEY_DNS),
    summary: () => childKey(QUERY_KEY_DNS, 'summary'),
    expanded: () => childKey(QUERY_KEY_DNS, 'expanded'),
  },
  general: {
    root: () => rootKey(QUERY_KEY_GENERAL),
    state: () => rootKey(QUERY_KEY_GENERAL_STATE),
    interfaces: () => rootKey(QUERY_KEY_GENERAL_INTERFACES),
  },
  group: {
    root: () => rootKey(QUERY_KEY_GROUP),
    summary: () => childKey(QUERY_KEY_GROUP, 'summary'),
    expanded: () => childKey(QUERY_KEY_GROUP, 'expanded'),
  },
  log: {
    root: () => rootKey(QUERY_KEY_LOG),
    items: () => childKey(QUERY_KEY_LOG, 'items'),
    settings: () => childKey(QUERY_KEY_LOG, 'settings'),
    runtimeLevel: () => childKey(QUERY_KEY_LOG, 'runtime-level'),
  },
  geodata: {
    status: () => rootKey(QUERY_KEY_GEODATA),
    settings: () => childKey(QUERY_KEY_GEODATA, 'settings'),
  },
  node: {
    list: () => rootKey(QUERY_KEY_NODE),
    subscriptionBackedList: () => childKey(QUERY_KEY_NODE, 'subscription-backed'),
    latency: () => rootKey(QUERY_KEY_NODE_LATENCY),
    latencyJob: () => rootKey(QUERY_KEY_NODE_LATENCY_JOB),
  },
  routing: {
    root: () => rootKey(QUERY_KEY_ROUTING),
    summary: () => childKey(QUERY_KEY_ROUTING, 'summary'),
    expanded: () => childKey(QUERY_KEY_ROUTING, 'expanded'),
  },
  storage: () => rootKey(QUERY_KEY_STORAGE),
  subscription: {
    root: () => rootKey(QUERY_KEY_SUBSCRIPTION),
    summary: () => childKey(QUERY_KEY_SUBSCRIPTION, 'summary'),
    expanded: () => childKey(QUERY_KEY_SUBSCRIPTION, 'expanded'),
  },
  traffic: {
    overview: (windowSec: number, maxPoints: number) => childKey(QUERY_KEY_TRAFFIC, windowSec, maxPoints),
  },
  user: () => rootKey(QUERY_KEY_USER),
} as const

export async function invalidateQueryKeys(queryClient: QueryInvalidator, queryKeys: QueryKey[]) {
  const seenKeys = new Set<string>()
  const uniqueKeys = queryKeys.filter((queryKey) => {
    const key = JSON.stringify(queryKey)
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  await Promise.all(uniqueKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
