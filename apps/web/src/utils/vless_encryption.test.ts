import {
  buildVlessEncryptionAccount,
  hasVlessEncryptionAccountPrefix,
  parseVlessEncryptionAccount,
  supportsVlessEncryptionNetwork,
} from './vless_encryption'

const X25519_PUBLIC_KEY = 'A'.repeat(43)
const ML_KEM_768_PUBLIC_KEY = 'B'.repeat(1579)

it.each(['', 'none'])('parses %j as disabled VLESS Encryption', (value) => {
  expect(parseVlessEncryptionAccount(value)).toEqual({
    enabled: false,
    mode: 'native',
    rtt: '1rtt',
    fields: '',
  })
})

it('round-trips VLESS Encryption keys and padding fields', () => {
  const value = `mlkem768x25519plus.xorpub.0rtt.${X25519_PUBLIC_KEY}.${ML_KEM_768_PUBLIC_KEY}.100-35-35.20-100-200`
  const account = parseVlessEncryptionAccount(value)

  expect(account).toEqual({
    enabled: true,
    mode: 'xorpub',
    rtt: '0rtt',
    fields: `${X25519_PUBLIC_KEY}.${ML_KEM_768_PUBLIC_KEY}.100-35-35.20-100-200`,
  })
  expect(buildVlessEncryptionAccount(account)).toBe(value)
})

it('rebuilds the canonical account after changing mode and RTT', () => {
  const account = parseVlessEncryptionAccount(`mlkem768x25519plus.native.1rtt.${X25519_PUBLIC_KEY}`)

  expect(buildVlessEncryptionAccount({ ...account, mode: 'random', rtt: '0rtt' })).toBe(
    `mlkem768x25519plus.random.0rtt.${X25519_PUBLIC_KEY}`,
  )
})

it('builds none when VLESS Encryption is disabled', () => {
  expect(
    buildVlessEncryptionAccount({
      enabled: false,
      mode: 'random',
      rtt: '0rtt',
      fields: X25519_PUBLIC_KEY,
    }),
  ).toBe('none')
})

it('recognizes a complete account pasted into the client fields control', () => {
  expect(hasVlessEncryptionAccountPrefix(`mlkem768x25519plus.random.0rtt.${X25519_PUBLIC_KEY}.100-35-35`)).toBe(true)
  expect(hasVlessEncryptionAccountPrefix(X25519_PUBLIC_KEY)).toBe(false)
})

it.each([
  ['tcp', true],
  ['ws', true],
  ['grpc', true],
  ['httpupgrade', true],
  ['xhttp', true],
  ['h2', false],
  ['meek', false],
  ['kcp', false],
  ['unknown', false],
])('reports VLESS Encryption network support for %s', (network, supported) => {
  expect(supportsVlessEncryptionNetwork(network)).toBe(supported)
})
