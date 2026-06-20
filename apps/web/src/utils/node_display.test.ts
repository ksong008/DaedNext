import { formatNodeLatencyCardLabel, getNodeLatencyCardTone } from './node_display'

it('formats successful latency without failure message details', () => {
  const result = {
    latencyMs: 123,
    message: 'resident TCP probe got empty response; handler_error=long failure',
  }

  expect(formatNodeLatencyCardLabel(result, 'Unavailable')).toBe('123 ms')
  expect(getNodeLatencyCardTone(result)).toBe('success')
})

it('formats failed latency as fail without exposing the reason', () => {
  const result = {
    latencyMs: null,
    message: 'resident TCP probe got empty response; handler_error=long failure',
  }

  expect(formatNodeLatencyCardLabel(result, 'Unavailable')).toBe('fail')
  expect(getNodeLatencyCardTone(result)).toBe('failure')
})

it('keeps no-result latency unavailable', () => {
  const result = { latencyMs: null, message: 'no latency result' }

  expect(formatNodeLatencyCardLabel(result, 'Unavailable')).toBe('Unavailable')
  expect(getNodeLatencyCardTone(result)).toBe('failure')
  expect(getNodeLatencyCardTone(undefined)).toBe('unavailable')
})
