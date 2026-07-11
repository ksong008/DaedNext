import { describe, expect, it, vi } from 'vitest'

import { updateSubscriptionResource, updateUserProfile } from './resource_updates'

describe('atomic resource updates', () => {
  it('sends all changed profile fields in one request', async () => {
    const patch = vi.fn(async () => ({ id: 1 }))

    await updateUserProfile(
      { patch },
      {
        username: 'new-login',
        name: 'New Name',
        avatar: 'data:image/png;base64,AA==',
      },
    )

    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('/user/me', {
      username: 'new-login',
      name: 'New Name',
      avatar: 'data:image/png;base64,AA==',
    })
  })

  it('sends the complete subscription edit in one request', async () => {
    const put = vi.fn(async () => ({ id: 7 }))

    await updateSubscriptionResource(
      { put },
      {
        id: '7',
        link: 'https://example.invalid/subscription',
        tag: 'primary',
        cronExp: '15 */4 * * *',
        cronEnable: true,
        useProxy: true,
      },
    )

    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith('/subscriptions/7', {
      link: 'https://example.invalid/subscription',
      tag: 'primary',
      cronExp: '15 */4 * * *',
      cronEnable: true,
      useProxy: true,
    })
  })
})
