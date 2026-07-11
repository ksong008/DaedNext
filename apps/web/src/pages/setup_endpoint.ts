import { normalizeEndpointURL } from '~/apis/client'

export interface ValidatedSetupEndpoint {
  endpointURL: string
  numberUsers: number
}

export async function validateAndPersistSetupEndpoint(
  rawEndpointURL: string,
  loadNumberUsers: (endpointURL: string) => Promise<number>,
  persistEndpointURL: (endpointURL: string) => void,
): Promise<ValidatedSetupEndpoint> {
  const endpointURL = normalizeEndpointURL(rawEndpointURL)
  const numberUsers = await loadNumberUsers(endpointURL)
  persistEndpointURL(endpointURL)
  return { endpointURL, numberUsers }
}
