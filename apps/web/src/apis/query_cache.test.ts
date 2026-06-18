import { describe, expect, it, vi } from 'vitest'
import { invalidateQueryKeys, webQueryKeys } from './query_cache'

describe('webQueryKeys', () => {
  it('keeps summary, expanded, and item cache domains separate', () => {
    expect(webQueryKeys.config.summary()).toEqual(['config', 'summary'])
    expect(webQueryKeys.config.expanded()).toEqual(['config', 'expanded'])
    expect(webQueryKeys.config.item('12')).toEqual(['config', 'item', '12'])
    expect(webQueryKeys.config.item()).toEqual(['config', 'item'])

    expect(webQueryKeys.group.summary()).toEqual(['group', 'summary'])
    expect(webQueryKeys.group.expanded()).toEqual(['group', 'expanded'])

    expect(webQueryKeys.subscription.summary()).toEqual(['subscription', 'summary'])
    expect(webQueryKeys.subscription.expanded()).toEqual(['subscription', 'expanded'])
  })

  it('targets daemon state without invalidating interface lists', () => {
    expect(webQueryKeys.general.root()).toEqual(['general'])
    expect(webQueryKeys.general.state()).toEqual(['general', 'state'])
    expect(webQueryKeys.general.interfaces()).toEqual(['general', 'interfaces'])
  })

  it('uses log subkeys for independent log cache invalidation', () => {
    expect(webQueryKeys.log.items()).toEqual(['log', 'items'])
    expect(webQueryKeys.log.settings()).toEqual(['log', 'settings'])
    expect(webQueryKeys.log.runtimeLevel()).toEqual(['log', 'runtime-level'])
  })
})

describe('invalidateQueryKeys', () => {
  it('deduplicates invalidation requests while preserving order', async () => {
    const invalidatedKeys: unknown[][] = []
    const invalidateQueries = vi.fn(async ({ queryKey }: { queryKey: unknown[] }) => {
      invalidatedKeys.push(queryKey)
    })

    await invalidateQueryKeys({ invalidateQueries: invalidateQueries as never }, [
      webQueryKeys.config.summary(),
      webQueryKeys.config.summary(),
      webQueryKeys.config.expanded(),
      webQueryKeys.general.state(),
    ])

    expect(invalidateQueries).toHaveBeenCalledTimes(3)
    expect(invalidatedKeys).toEqual([
      ['config', 'summary'],
      ['config', 'expanded'],
      ['general', 'state'],
    ])
  })
})
