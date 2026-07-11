import { toNumericID } from './client'

export interface ProfileResourceSelection {
  configID: string
  dnsID: string
  routingID: string
}

export interface ProfileSelectionResponse {
  selected: {
    configId: number
    dnsId: number
    routingId: number
  }
}

interface ProfileSelectionClient {
  post: (path: string, body?: unknown) => Promise<ProfileSelectionResponse>
}

export function selectProfileResources(client: ProfileSelectionClient, selection: ProfileResourceSelection) {
  return client.post('/profiles/select', {
    configId: toNumericID(selection.configID),
    dnsId: toNumericID(selection.dnsID),
    routingId: toNumericID(selection.routingID),
  })
}
