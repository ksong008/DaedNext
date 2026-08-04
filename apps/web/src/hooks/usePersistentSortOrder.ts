import type { PersistentSortableKeys } from '~/store'
import type { GroupSortMembership } from '~/utils/sort_order'
import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { enqueueGroupSortStateWrite } from '~/apis/group_sort_storage'
import { webQueryKeys } from '~/apis/query_cache'
import { useAPIClient } from '~/contexts'
import { isMockMode } from '~/mocks'
import { appStateAtom, endpointURLAtom, groupSortOrdersAtom, tokenAtom } from '~/store'
import {
  createGroupSortState,
  GROUP_SORT_STATE_STORAGE_KEY,
  parseGroupSortState,
  serializeGroupSortState,
} from '~/utils/group_sort_state'
import { reconcileGroupSortOrders, reconcileSortOrder } from '~/utils/sort_order'

type SortOrderKey = keyof PersistentSortableKeys

interface JSONStorageResponse {
  values: string[]
}

function authStorageScope(endpointURL: string, token: string): string {
  let hash = 0x811C9DC5
  for (const byte of new TextEncoder().encode(`${endpointURL}\0${token}`)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function useServerGroupSortState(): boolean {
  const apiClient = useAPIClient()
  const appState = useStore(appStateAtom)
  const groupSortOrders = useStore(groupSortOrdersAtom)
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)
  const authScope = useMemo(() => authStorageScope(endpointURL, token), [endpointURL, token])
  const [ready, setReady] = useState(false)
  const hydratedScopeRef = useRef<string | null>(null)
  const hydratedRawRef = useRef<string | null>(null)
  const lastPersistedRef = useRef<string | null>(null)
  const lastEnqueuedRef = useRef<string | null>(null)

  const storageQuery = useQuery({
    queryKey: webQueryKeys.groupSortState(authScope),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<JSONStorageResponse>(
        '/user/me/storage',
        { path: [GROUP_SORT_STATE_STORAGE_KEY] },
        { signal },
      )
      return response.values[0] ?? ''
    },
    enabled: isMockMode() || !!token,
    staleTime: 0,
  })

  useEffect(() => {
    if (!storageQuery.isSuccess) return
    const raw = storageQuery.data ?? ''
    if (hydratedScopeRef.current === authScope && hydratedRawRef.current === raw) return

    const remoteState = parseGroupSortState(raw)
    const nextState =
      remoteState ?? createGroupSortState(appStateAtom.get().groupSortableKeys, groupSortOrdersAtom.get())
    const serialized = serializeGroupSortState(nextState)

    hydratedScopeRef.current = authScope
    hydratedRawRef.current = raw
    lastPersistedRef.current = remoteState ? serialized : null
    lastEnqueuedRef.current = remoteState ? serialized : null

    appStateAtom.setKey('groupSortableKeys', nextState.groupSortableKeys)
    groupSortOrdersAtom.set(nextState.groupSortOrders)
    setReady(true)

    if (!remoteState) {
      lastEnqueuedRef.current = serialized
      void enqueueGroupSortStateWrite(apiClient, nextState)
        .then(() => {
          lastPersistedRef.current = serialized
        })
        .catch(() => {
          if (lastEnqueuedRef.current === serialized) lastEnqueuedRef.current = null
        })
    }
  }, [apiClient, authScope, storageQuery.data, storageQuery.isSuccess])

  useEffect(() => {
    if (!storageQuery.isError || hydratedScopeRef.current === authScope) return
    hydratedScopeRef.current = authScope
    setReady(true)
  }, [authScope, storageQuery.isError])

  useEffect(() => {
    if (!ready || hydratedScopeRef.current !== authScope) return
    const state = createGroupSortState(appState.groupSortableKeys, groupSortOrders)
    const serialized = serializeGroupSortState(state)
    if (serialized === lastPersistedRef.current || serialized === lastEnqueuedRef.current) return

    const timer = window.setTimeout(() => {
      lastEnqueuedRef.current = serialized
      void enqueueGroupSortStateWrite(apiClient, state)
        .then(() => {
          lastPersistedRef.current = serialized
        })
        .catch(() => {
          if (lastEnqueuedRef.current === serialized) lastEnqueuedRef.current = null
        })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [apiClient, appState.groupSortableKeys, authScope, groupSortOrders, ready])

  return ready
}

export function usePersistentSortOrder(
  key: SortOrderKey,
  storedOrder: string[],
  currentIds: readonly string[],
  ready: boolean,
): string[] {
  const reconciledOrder = useMemo(
    () => (ready ? reconcileSortOrder(storedOrder, currentIds) : storedOrder),
    [currentIds, ready, storedOrder],
  )

  useEffect(() => {
    if (!ready) return

    const latestOrder = appStateAtom.get()[key]
    const latestReconciledOrder = reconcileSortOrder(latestOrder, currentIds)
    if (latestReconciledOrder !== latestOrder) {
      appStateAtom.setKey(key, latestReconciledOrder)
    }
  }, [currentIds, key, ready, storedOrder])

  return reconciledOrder
}

export function usePersistentGroupSortOrders(memberships: readonly GroupSortMembership[], ready: boolean): void {
  const storedOrders = useStore(groupSortOrdersAtom)

  useEffect(() => {
    if (!ready) return

    const latestOrders = groupSortOrdersAtom.get()
    const latestReconciledOrders = reconcileGroupSortOrders(latestOrders, memberships)
    if (latestReconciledOrders !== latestOrders) {
      groupSortOrdersAtom.set(latestReconciledOrders)
    }
  }, [memberships, ready, storedOrders])
}
