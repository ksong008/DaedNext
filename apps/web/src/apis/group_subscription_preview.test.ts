import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

describe('group subscription filter preview', () => {
  it('passes cancellation through and adapts only bounded sample nodes', async () => {
    const { requestGroupSubscriptionFilterPreview } = await loadPreviewModule()
    const signal = new AbortController().signal
    const post = vi.fn(async () => ({
      matchedCount: 12,
      items: [
        {
          subscriptionId: 7,
          matchedCount: 12,
          sampleTruncated: true,
          sampleMatchedNodes: [
            {
              id: 11,
              link: 'vless://example.invalid:443?security=tls&type=ws#Alpha',
              name: 'Alpha',
              address: 'example.invalid:443',
              protocol: 'vless',
              subscriptionId: 7,
            },
          ],
        },
      ],
    }))

    const result = await requestGroupSubscriptionFilterPreview({ post } as never, ['7'], '(?i)^alpha', signal)

    expect(post).toHaveBeenCalledWith(
      '/groups/subscription-preview',
      { subscriptionIds: ['7'], nameFilterRegex: '(?i)^alpha' },
      undefined,
      { signal },
    )
    expect(result.matchedCount).toBe(12)
    expect(result.items[0]).toMatchObject({
      subscriptionID: '7',
      matchedCount: 12,
      sampleTruncated: true,
      sampleMatchedNodes: [{ id: '11', title: 'Alpha', protocol: 'vless', transport: 'ws' }],
    })
  })

  it('cancels a stale request while it is still in the debounce window', async () => {
    const { waitForGroupSubscriptionFilterPreviewDebounce } = await loadPreviewModule()
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = waitForGroupSubscriptionFilterPreviewDebounce(controller.signal)

    controller.abort(new Error('stale preview'))

    await expect(pending).rejects.toThrow('stale preview')
  })
})

async function loadPreviewModule() {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      hostname: '127.0.0.1',
      protocol: 'http:',
    },
  })
  return import('./group_subscription_preview')
}
