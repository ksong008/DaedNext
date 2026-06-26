import type { InterfaceResource } from '~/apis/types'

export function hasDefaultRoutes(iface: Pick<InterfaceResource, 'defaultRoutes'>) {
  return Array.isArray(iface.defaultRoutes) && iface.defaultRoutes.length > 0
}

export function interfaceAddresses(iface: Pick<InterfaceResource, 'addresses' | 'addressDetails'>) {
  const addresses = Array.isArray(iface.addresses) ? iface.addresses.filter((address) => address.trim().length > 0) : []
  if (addresses.length > 0) return addresses

  return Array.isArray(iface.addressDetails)
    ? iface.addressDetails
        .filter((detail) => detail.local.trim().length > 0)
        .map((detail) =>
          typeof detail.prefixlen === 'number' && Number.isFinite(detail.prefixlen)
            ? `${detail.local}/${detail.prefixlen}`
            : detail.local,
        )
    : []
}

export function interfaceAddressSummary(iface: Pick<InterfaceResource, 'addresses' | 'addressDetails'>) {
  const addresses = interfaceAddresses(iface)
  return addresses.length > 0 ? addresses.join(', ') : undefined
}
