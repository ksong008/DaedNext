import { describe, expect, it } from 'vitest'

import { validateDNSFormValues } from './validation'

describe('dNS form validation', () => {
  it('rejects whitespace-only names and DNS documents', () => {
    expect(validateDNSFormValues({ name: '  ', text: '\n\t' })).toEqual({
      name: 'required',
      text: 'required',
    })
  })

  it('accepts non-empty values without rewriting user text', () => {
    expect(validateDNSFormValues({ name: ' default ', text: ' upstream {} ' })).toEqual({})
  })
})
