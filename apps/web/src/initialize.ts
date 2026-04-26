import { useCallback } from 'react'

import { getInterfacesRequest, useEnsureDefaultResourcesMutation } from '~/apis'
import {
  DEFAULT_CONFIG_NAME,
  DEFAULT_CONFIG_WITH_LAN_INTERFACEs,
  DEFAULT_DNS,
  DEFAULT_DNS_NAME,
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_POLICY,
  DEFAULT_ROUTING,
  DEFAULT_ROUTING_NAME,
  MODE,
} from '~/constants'
import { useGQLQueryClient } from '~/contexts'
import { isMockMode, MOCK_DEFAULT_IDS } from '~/mocks'
import { defaultResourcesAtom, modeAtom } from '~/store'

export function useInitialize() {
  const ensureDefaultResourcesMutation = useEnsureDefaultResourcesMutation()
  const gqlClient = useGQLQueryClient()
  const getInterfaces = getInterfacesRequest(gqlClient)

  return useCallback(async () => {
    // In mock mode, use mock default IDs directly
    if (isMockMode()) {
      modeAtom.set(MODE.rule)
      defaultResourcesAtom.set(MOCK_DEFAULT_IDS)
      return
    }

    const lanInterfaces = (await getInterfaces()).general.interfaces
      .filter(({ flag }) => !!flag.default)
      .map(({ name }) => name)

    const {
      ensureDefaultResources: { defaultConfigID, defaultDNSID, defaultGroupID, defaultRoutingID, mode },
    } = await ensureDefaultResourcesMutation.mutateAsync({
      configName: DEFAULT_CONFIG_NAME,
      global: DEFAULT_CONFIG_WITH_LAN_INTERFACEs(lanInterfaces),
      dnsName: DEFAULT_DNS_NAME,
      dns: DEFAULT_DNS,
      routingName: DEFAULT_ROUTING_NAME,
      routing: DEFAULT_ROUTING,
      groupName: DEFAULT_GROUP_NAME,
      policy: DEFAULT_GROUP_POLICY,
      policyParams: [],
      mode: MODE.simple,
    })

    modeAtom.set(mode as MODE)
    defaultResourcesAtom.set({ defaultConfigID, defaultDNSID, defaultGroupID, defaultRoutingID })
  }, [ensureDefaultResourcesMutation, getInterfaces])
}
