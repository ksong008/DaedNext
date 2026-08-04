import type { APIClientInterface } from './client'
import { describe, expect, it } from 'vitest'

import { enqueueGroupSortStateWrite, flushGroupSortStateWrites } from './group_sort_storage'

describe('group sort storage write queue', () => {
  it('serializes writes so a stale request cannot finish after the newest order', async () => {
    const observed: string[] = []
    let invocation = 0
    let releaseFirst: (() => void) | undefined
    const apiClient = {
      put: async <T>(_path: string, body?: unknown): Promise<T> => {
        invocation += 1
        const request = body as { values: string[] }
        observed.push(request.values[0])
        if (invocation === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
        }
        return { updated: 1 } as T
      },
    } as APIClientInterface
    const firstState = { version: 1 as const, groupSortableKeys: ['1'], groupSortOrders: {} }
    const secondState = { version: 1 as const, groupSortableKeys: ['2', '1'], groupSortOrders: {} }

    const first = enqueueGroupSortStateWrite(apiClient, firstState)
    const second = enqueueGroupSortStateWrite(apiClient, secondState)
    await Promise.resolve()
    await Promise.resolve()
    expect(observed).toEqual([JSON.stringify(firstState)])

    releaseFirst?.()
    await Promise.all([first, second, flushGroupSortStateWrites()])
    expect(observed).toEqual([JSON.stringify(firstState), JSON.stringify(secondState)])
  })
})
