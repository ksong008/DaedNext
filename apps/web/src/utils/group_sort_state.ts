import type { GroupSortOrders } from '~/store'

export const GROUP_SORT_STATE_STORAGE_KEY = 'groupSortStateV1'
export const GROUP_SORT_STATE_VERSION = 1 as const

export interface GroupSortStateV1 {
  version: typeof GROUP_SORT_STATE_VERSION
  groupSortableKeys: string[]
  groupSortOrders: GroupSortOrders
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value)]
}

export function normalizeGroupSortState(value: unknown): GroupSortStateV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  if (record.version !== GROUP_SORT_STATE_VERSION) return null

  const groupSortableKeys = normalizeStringArray(record.groupSortableKeys)
  if (!groupSortableKeys) return null

  if (!record.groupSortOrders || typeof record.groupSortOrders !== 'object' || Array.isArray(record.groupSortOrders)) {
    return null
  }

  const groupSortOrders: GroupSortOrders = {}
  for (const [groupId, order] of Object.entries(record.groupSortOrders)) {
    if (!order || typeof order !== 'object' || Array.isArray(order)) return null
    const orderRecord = order as Record<string, unknown>
    const nodes = normalizeStringArray(orderRecord.nodes)
    const subscriptions = normalizeStringArray(orderRecord.subscriptions)
    if (!nodes || !subscriptions) return null
    groupSortOrders[groupId] = { nodes, subscriptions }
  }

  return {
    version: GROUP_SORT_STATE_VERSION,
    groupSortableKeys,
    groupSortOrders,
  }
}

export function parseGroupSortState(raw: string): GroupSortStateV1 | null {
  if (!raw.trim()) return null
  try {
    return normalizeGroupSortState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function createGroupSortState(
  groupSortableKeys: readonly string[],
  groupSortOrders: GroupSortOrders,
): GroupSortStateV1 {
  return (
    normalizeGroupSortState({
      version: GROUP_SORT_STATE_VERSION,
      groupSortableKeys,
      groupSortOrders,
    }) ?? {
      version: GROUP_SORT_STATE_VERSION,
      groupSortableKeys: [],
      groupSortOrders: {},
    }
  )
}

export function serializeGroupSortState(state: GroupSortStateV1): string {
  return JSON.stringify(state)
}
