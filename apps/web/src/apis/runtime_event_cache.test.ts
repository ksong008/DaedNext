import { describe, expect, it, vi } from 'vitest'
import { handleRuntimeGroupSelectionEvent } from './runtime_event_cache'

describe('handleRuntimeGroupSelectionEvent', () => {
  it('invalidates only the group summary when the selector generation changes', () => {
    const invalidateQueries = vi.fn(async () => undefined)

    const generation = handleRuntimeGroupSelectionEvent(
      { invalidateQueries: invalidateQueries as never },
      '{"generation":"sha256:first"}',
      null,
    )

    expect(generation).toBe('sha256:first')
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['group', 'summary'] })

    const unchanged = handleRuntimeGroupSelectionEvent(
      { invalidateQueries: invalidateQueries as never },
      '{"generation":"sha256:first"}',
      generation,
    )
    expect(unchanged).toBe(generation)
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
  })

  it('ignores malformed and empty generation payloads', () => {
    const invalidateQueries = vi.fn(async () => undefined)

    expect(
      handleRuntimeGroupSelectionEvent({ invalidateQueries: invalidateQueries as never }, '{"generation":""}', null),
    ).toBeNull()
    expect(
      handleRuntimeGroupSelectionEvent({ invalidateQueries: invalidateQueries as never }, 'not-json', null),
    ).toBeNull()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
