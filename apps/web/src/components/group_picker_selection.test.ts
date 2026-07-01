import { describe, expect, it } from 'vitest'

import { nextGroupPickerSelectedIds } from './group_picker_selection'

describe('nextGroupPickerSelectedIds', () => {
  it('keeps multiple mode additive', () => {
    expect(nextGroupPickerSelectedIds(['old'], 'new')).toEqual(['old', 'new'])
  })

  it('replaces the previous item in single mode', () => {
    expect(nextGroupPickerSelectedIds(['old'], 'new', 'single')).toEqual(['new'])
  })

  it('allows toggling the current item off', () => {
    expect(nextGroupPickerSelectedIds(['old'], 'old', 'single')).toEqual([])
  })
})
