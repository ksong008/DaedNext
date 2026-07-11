import { z } from 'zod'

export const ACCOUNT_PASSWORD_MIN_LENGTH = 8
export const ACCOUNT_PASSWORD_POLICY_MESSAGE =
  'Password must contain letters and numbers, and be at least 8 characters long'

const ASCII_LETTER_PATTERN = /[a-z]/i
const ASCII_DIGIT_PATTERN = /\d/

export const accountPasswordSchema = z
  .string()
  .min(ACCOUNT_PASSWORD_MIN_LENGTH, ACCOUNT_PASSWORD_POLICY_MESSAGE)
  .refine(
    (value) => ASCII_LETTER_PATTERN.test(value) && ASCII_DIGIT_PATTERN.test(value),
    ACCOUNT_PASSWORD_POLICY_MESSAGE,
  )

export const loginPasswordSchema = z.string().min(1, 'Password is required')
