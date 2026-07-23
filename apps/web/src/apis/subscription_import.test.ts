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
    fetchError: null,
    refreshError: null,
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

  it('keeps a failed initial fetch separate from node import failures', async () => {
    const { importSubscriptions } = await import('./subscription_import')
    const post = vi.fn(async () => ({
      ...response(9),
      error:
        'subscription 9 was created, but its initial fetch failed: subscription TLS certificate is not issued by a trusted authority',
      partialFailure: true,
      fetchError: {
        code: 'tls_unknown_issuer',
        message: 'subscription TLS certificate is not issued by a trusted authority',
        retryable: false,
      },
      failedNodeCount: 0,
      nodeImportResult: [],
    }))
    const client = { post } as unknown as Pick<APIClientInterface, 'post'>

    const [result] = await importSubscriptions(client, [{ link: 'https://subscription.invalid/nine', tag: 'nine' }])

    expect(result.subscriptionCreated).toBe(true)
    expect(result.fetchError?.code).toBe('tls_unknown_issuer')
    expect(result.failedNodeCount).toBe(0)
    expect(result.nodeImportResult).toEqual([])
    expect(result.error).toContain('initial fetch failed')
    expect(result.error).not.toContain('node import')
  })
})
