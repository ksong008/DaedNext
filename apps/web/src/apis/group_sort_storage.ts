import type { APIClientInterface } from './client'
import type { GroupSortStateV1 } from '~/utils/group_sort_state'

import { GROUP_SORT_STATE_STORAGE_KEY, serializeGroupSortState } from '~/utils/group_sort_state'

interface CountResponse {
  updated?: number
}

let pendingGroupSortWrite: Promise<void> = Promise.resolve()

export function enqueueGroupSortStateWrite(apiClient: APIClientInterface, state: GroupSortStateV1): Promise<void> {
  const value = serializeGroupSortState(state)
  const write = pendingGroupSortWrite
    .catch(() => undefined)
    .then(async () => {
      const response = await apiClient.put<CountResponse>('/user/me/storage', {
        paths: [GROUP_SORT_STATE_STORAGE_KEY],
        values: [value],
      })
      if (response.updated !== 1) {
        throw new Error('group sort order was not persisted')
      }
    })
  pendingGroupSortWrite = write
  return write
}

export function flushGroupSortStateWrites(): Promise<void> {
  return pendingGroupSortWrite
}
