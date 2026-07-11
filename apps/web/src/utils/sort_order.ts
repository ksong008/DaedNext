export interface PersistedGroupSortOrder {
  nodes: string[]
  subscriptions: string[]
}

export type PersistedGroupSortOrders = Record<string, PersistedGroupSortOrder>

export interface GroupSortMembership {
  id: string
  nodeIds: string[]
  subscriptionIds: string[]
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function reconcileSortOrder(storedIds: string[], currentIds: readonly string[]): string[] {
  const currentIdSet = new Set(currentIds)
  const seenIds = new Set<string>()
  const reconciled: string[] = []

  for (const id of storedIds) {
    if (!currentIdSet.has(id) || seenIds.has(id)) continue
    seenIds.add(id)
    reconciled.push(id)
  }

  for (const id of currentIds) {
    if (seenIds.has(id)) continue
    seenIds.add(id)
    reconciled.push(id)
  }

  return stringArraysEqual(storedIds, reconciled) ? storedIds : reconciled
}

export function reconcileGroupSortOrders(
  storedOrders: PersistedGroupSortOrders,
  memberships: readonly GroupSortMembership[],
): PersistedGroupSortOrders {
  const reconciledOrders: PersistedGroupSortOrders = {}
  let changed = Object.keys(storedOrders).length !== memberships.length

  for (const membership of memberships) {
    const storedOrder = storedOrders[membership.id]
    const storedNodes = Array.isArray(storedOrder?.nodes) ? storedOrder.nodes : []
    const storedSubscriptions = Array.isArray(storedOrder?.subscriptions) ? storedOrder.subscriptions : []
    const nodes = reconcileSortOrder(storedNodes, membership.nodeIds)
    const subscriptions = reconcileSortOrder(storedSubscriptions, membership.subscriptionIds)

    if (storedOrder && nodes === storedOrder.nodes && subscriptions === storedOrder.subscriptions) {
      reconciledOrders[membership.id] = storedOrder
      continue
    }

    changed = true
    reconciledOrders[membership.id] = { nodes, subscriptions }
  }

  return changed ? reconciledOrders : storedOrders
}
