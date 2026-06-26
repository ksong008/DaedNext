import { interfaceAddresses } from './interfaces'

it('formats addresses from structured interface details when display addresses are absent', () => {
  expect(
    interfaceAddresses({
      addresses: [],
      addressDetails: [
        { family: 'inet', local: '192.0.2.10', prefixlen: 24, scope: 'global' },
        { family: 'inet6', local: '2001:db8::10', prefixlen: 64, scope: 'global' },
      ],
    }),
  ).toEqual(['192.0.2.10/24', '2001:db8::10/64'])
})

it('keeps display addresses as the compatibility source when present', () => {
  expect(
    interfaceAddresses({
      addresses: ['192.0.2.20/24'],
      addressDetails: [{ family: 'inet6', local: '2001:db8::20', prefixlen: 64, scope: 'global' }],
    }),
  ).toEqual(['192.0.2.20/24'])
})
