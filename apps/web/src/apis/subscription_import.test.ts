import type { APIClientInterface } from './client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function response(id: number) {
  return {
    link: `https://subscription.invalid/${id}`,
    error: null,
    subscriptionCreated: true,
    importedNodeCount: 0,
    failedNodeCount: 0,
    partialFailure: false,
    subscription: { id },
    nodeImportResult: [],
  }
}

describe('subscription import admission', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects duplicate nonempty tags before sending any request', async () => {
    const { DuplicateSubscriptionTagError, importSubscriptions } = await import('./subscription_import')
    const post = vi.fn()
    const client = { post } as unknown as Pick<APIClientInterface, 'post'>

    expect(() =>
      importSubscriptions(client, [
        { link: 'https://subscription.invalid/one', tag: 'shared' },
        { link: 'https://subscription.invalid/two', tag: 'shared' },
      ]),
    ).toThrow(DuplicateSubscriptionTagError)
    expect(post).not.toHaveBeenCalled()
  })

  it('retains exact case-sensitive tag identity and nullable tag behavior', async () => {
    const { importSubscriptions } = await import('./subscription_import')
    let nextID = 0
    const post = vi.fn(async () => response(++nextID))
    const client = { post } as unknown as Pick<APIClientInterface, 'post'>

    const imported = await importSubscriptions(client, [
      { link: 'https://subscription.invalid/upper', tag: 'Shared' },
      { link: 'https://subscription.invalid/lower', tag: 'shared' },
      { link: 'https://subscription.invalid/null', tag: null },
      { link: 'https://subscription.invalid/empty', tag: '' },
    ])

    expect(post).toHaveBeenCalledTimes(4)
    expect(imported).toHaveLength(4)
  })
})
