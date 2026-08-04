import { describe, expect, it } from 'vitest'

import {
  createGroupSortState,
  normalizeGroupSortState,
  parseGroupSortState,
  serializeGroupSortState,
} from './group_sort_state'

describe('server-backed group sort state', () => {
  it('round-trips the top-level and per-group order', () => {
    const state = createGroupSortState(['2', '1'], {
      '1': { nodes: ['9', '8'], subscriptions: ['3'] },
    })

    expect(parseGroupSortState(serializeGroupSortState(state))).toEqual(state)
  })

  it('deduplicates locally migrated identifiers without reordering them', () => {
    expect(
      createGroupSortState(['2', '2', '1'], {
        '1': { nodes: ['9', '9', '8'], subscriptions: ['3', '3'] },
      }),
    ).toEqual({
      version: 1,
      groupSortableKeys: ['2', '1'],
      groupSortOrders: {
        '1': { nodes: ['9', '8'], subscriptions: ['3'] },
      },
    })
  })

  it('rejects malformed or unsupported server values', () => {
    expect(parseGroupSortState('')).toBeNull()
    expect(parseGroupSortState('{')).toBeNull()
    expect(normalizeGroupSortState({ version: 2, groupSortableKeys: [], groupSortOrders: {} })).toBeNull()
    expect(
      normalizeGroupSortState({
        version: 1,
        groupSortableKeys: ['1'],
        groupSortOrders: { '1': { nodes: [9], subscriptions: [] } },
      }),
    ).toBeNull()
  })
})
