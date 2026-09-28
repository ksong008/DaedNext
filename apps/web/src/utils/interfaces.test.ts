import { interfaceAddresses, recommendedLanInterfaces } from './interfaces'

it('uses the host LAN recommendation instead of selecting the default-route WAN', () => {
  expect(
    recommendedLanInterfaces([
      { name: 'wan', index: 1, up: true, addresses: ['192.0.2.2/24'], defaultRoutes: [{}], recommendedLan: false },
      { name: 'br-lan', index: 2, up: true, addresses: ['192.168.1.1/24'], recommendedLan: true },
    ]),
  ).toEqual(['br-lan'])
})

it('preserves a recommended single-interface side-router LAN', () => {
  expect(
    recommendedLanInterfaces([
      { name: 'eth0', index: 1, up: true, addresses: ['192.168.1.2/24'], defaultRoutes: [{}], recommendedLan: true },
    ]),
  ).toEqual(['eth0'])
})

it('does not guess a LAN when topology is unavailable or the recommended interface is down', () => {
  expect(
    recommendedLanInterfaces([
      { name: 'wan', index: 1, up: true, addresses: [], defaultRoutes: [{}] },
      { name: 'br-lan', index: 2, up: false, addresses: [], recommendedLan: true },
    ]),
  ).toEqual([])
})

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
