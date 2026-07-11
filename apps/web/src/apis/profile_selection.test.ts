import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('selectProfileResources', () => {
  it('switches all profile resources with one backend request', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: '127.0.0.1',
    })
    const { selectProfileResources } = await import('./profile_selection')
    const post = vi.fn(async (_path: string, _body?: unknown) => ({
      selected: { configId: 2, dnsId: 3, routingId: 4 },
    }))

    await selectProfileResources(
      { post },
      {
        configID: '2',
        dnsID: '3',
        routingID: '4',
      },
    )

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/profiles/select', {
      configId: 2,
      dnsId: 3,
      routingId: 4,
    })
  })
})
