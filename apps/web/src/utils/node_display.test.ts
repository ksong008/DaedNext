import { formatNodeLatencyCardLabel } from './node_display'

it('formats successful latency without failure message details', () => {
  expect(
    formatNodeLatencyCardLabel(
      {
        latencyMs: 123,
        message: 'resident TCP probe got empty response; handler_error=long failure',
      },
      'Unavailable',
    ),
  ).toBe('123 ms')
})

it('formats failed latency as fail without exposing the reason', () => {
  expect(
    formatNodeLatencyCardLabel(
      {
        latencyMs: null,
        message: 'resident TCP probe got empty response; handler_error=long failure',
      },
      'Unavailable',
    ),
  ).toBe('fail')
})

it('keeps no-result latency unavailable', () => {
  expect(formatNodeLatencyCardLabel({ latencyMs: null, message: 'no latency result' }, 'Unavailable')).toBe(
    'Unavailable',
  )
})
