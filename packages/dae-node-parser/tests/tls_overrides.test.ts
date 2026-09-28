import { Base64 } from 'js-base64'
import { describe, expect, it } from 'vitest'
import { parseNodeUrl } from '../src/parser'

describe('tLS verification override parsing', () => {
  it.each(['https', 'trojan', 'trojan-go', 'tuic', 'juicity', 'anytls', 'vless'])(
    'recognizes aliases and rejects conflicting parameters: %s',
    (scheme) => {
      for (const key of ['allowInsecure', 'allow_insecure', 'allowinsecure', 'insecure', 'skipVerify']) {
        for (const [value, expected] of [
          ['0', false],
          ['false', false],
          ['F', false],
          ['1', true],
          ['true', true],
          ['T', true],
        ] as const) {
          const parsed = parseNodeUrl(`${scheme}://auth@example.com:443?${key}=${value}`)
          expect(parsed, `${scheme} ${key}=${value}`).toMatchObject({ data: { allowInsecure: expected } })
        }
      }
      expect(parseNodeUrl(`${scheme}://auth@example.com:443`)).toMatchObject({ data: { allowInsecure: null } })
      expect(parseNodeUrl(`${scheme}://auth@example.com:443?insecure=0&allowInsecure=1`)).toBeNull()
      expect(parseNodeUrl(`${scheme}://auth@example.com:443?insecure=invalid`)).toBeNull()
    },
  )

  it('preserves VMess JSON boolean, numeric and string overrides', () => {
    for (const [raw, expected] of [
      [undefined, null],
      [false, false],
      [0, false],
      ['false', false],
      ['0', false],
      [true, true],
      [1, true],
      ['true', true],
    ] as const) {
      const body = { add: 'example.com', port: '443', id: 'uuid', tls: 'tls', allowInsecure: raw }
      expect(parseNodeUrl(`vmess://${Base64.encode(JSON.stringify(body))}`)).toMatchObject({
        data: { allowInsecure: expected },
      })
    }
  })
})
