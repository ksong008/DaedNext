import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('location', {
    protocol: 'http:',
    hostname: '127.0.0.1',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('setup endpoint validation', () => {
  it('persists a normalized endpoint only after validation succeeds', async () => {
    const { validateAndPersistSetupEndpoint } = await import('./setup_endpoint')
    const events: string[] = []
    const loadStatus = vi.fn(async (endpointURL: string) => {
      events.push(`validated:${endpointURL}`)
      return 1
    })
    const persist = vi.fn((endpointURL: string) => {
      events.push(`persisted:${endpointURL}`)
    })

    const result = await validateAndPersistSetupEndpoint('http://router.test:2023', loadStatus, persist)

    expect(result).toEqual({ endpointURL: 'http://router.test:2023/api', numberUsers: 1 })
    expect(events).toEqual(['validated:http://router.test:2023/api', 'persisted:http://router.test:2023/api'])
  })

  it('does not persist an endpoint when validation fails', async () => {
    const { validateAndPersistSetupEndpoint } = await import('./setup_endpoint')
    const persist = vi.fn()

    await expect(
      validateAndPersistSetupEndpoint(
        'http://unreachable.test:2023',
        async () => {
          throw new Error('unreachable')
        },
        persist,
      ),
    ).rejects.toThrow('unreachable')

    expect(persist).not.toHaveBeenCalled()
  })
})
