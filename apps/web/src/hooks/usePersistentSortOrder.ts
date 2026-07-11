import type { PersistentSortableKeys } from '~/store'
import type { GroupSortMembership } from '~/utils/sort_order'
import { useStore } from '@nanostores/react'
import { useEffect, useMemo } from 'react'

import { appStateAtom, groupSortOrdersAtom } from '~/store'
import { reconcileGroupSortOrders, reconcileSortOrder } from '~/utils/sort_order'

type SortOrderKey = keyof PersistentSortableKeys

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
