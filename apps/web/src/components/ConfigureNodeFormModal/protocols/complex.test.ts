import { afterEach, describe, expect, it, vi } from 'vitest'

describe('manual node protocol registry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps Hysteria2 port hopping when generating registry links', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
    })

    const { hysteria2Protocol } = await import('./complex')
    const link = hysteria2Protocol.generateLink({
      ...hysteria2Protocol.defaultValues,
      server: 'example.com',
      port: 443,
      auth: 'secret',
      ports: '10000-20000,443',
    })

    expect(new URL(link).searchParams.get('ports')).toBe('10000-20000,443')
  })
})
