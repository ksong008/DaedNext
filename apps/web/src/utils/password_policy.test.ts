import { describe, expect, it } from 'vitest'

import { accountPasswordSchema, loginPasswordSchema } from './password_policy'

describe('account password policy', () => {
  it('accepts a login password longer than twenty characters', () => {
    expect(loginPasswordSchema.safeParse('long-password-12345678901234567890').success).toBe(true)
  })

  it('keeps account creation and password changes on the strength policy', () => {
    expect(accountPasswordSchema.safeParse('password1').success).toBe(true)
    expect(accountPasswordSchema.safeParse('password-only').success).toBe(false)
  })
})
