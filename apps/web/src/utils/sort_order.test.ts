import { describe, expect, it } from 'vitest'

import { reconcileGroupSortOrders, reconcileSortOrder } from './sort_order'

describe('persistent sort-order reconciliation', () => {
  it('removes stale and duplicate IDs while preserving valid user order', () => {
    expect(reconcileSortOrder(['b', 'stale', 'b', 'a'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('returns the existing array when no persistent write is needed', () => {
    const stored = ['b', 'a']
    expect(reconcileSortOrder(stored, ['a', 'b'])).toBe(stored)
  })

  it('removes deleted groups and reconciles each current group membership', () => {
    const reconciled = reconcileGroupSortOrders(
      {
        deleted: { nodes: ['gone'], subscriptions: ['gone'] },
        proxy: { nodes: ['n2', 'stale', 'n2'], subscriptions: ['s1', 'stale'] },
      },
      [
        { id: 'proxy', nodeIds: ['n1', 'n2'], subscriptionIds: ['s1', 's2'] },
        { id: 'media', nodeIds: ['n3'], subscriptionIds: [] },
      ],
    )

    expect(reconciled).toEqual({
      proxy: { nodes: ['n2', 'n1'], subscriptions: ['s1', 's2'] },
      media: { nodes: ['n3'], subscriptions: [] },
    })
  })

  it('returns the existing group record when every order is already canonical', () => {
    const stored = {
      proxy: { nodes: ['n2', 'n1'], subscriptions: ['s1'] },
    }
    expect(reconcileGroupSortOrders(stored, [{ id: 'proxy', nodeIds: ['n1', 'n2'], subscriptionIds: ['s1'] }])).toBe(
      stored,
    )
  })
})
