import type { InterfaceResource } from '~/apis/types'

export function hasDefaultRoutes(iface: Pick<InterfaceResource, 'defaultRoutes'>) {
  return Array.isArray(iface.defaultRoutes) && iface.defaultRoutes.length > 0
}

export function interfaceAddresses(iface: Pick<InterfaceResource, 'addresses'>) {
  return Array.isArray(iface.addresses) ? iface.addresses.filter((address) => address.trim().length > 0) : []
}

export function interfaceAddressSummary(iface: Pick<InterfaceResource, 'addresses'>) {
  const addresses = interfaceAddresses(iface)
  return addresses.length > 0 ? addresses.join(', ') : undefined
}
