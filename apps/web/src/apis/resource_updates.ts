export interface UserProfileUpdate {
  username?: string
  name?: string
  avatar?: string
}

export interface SubscriptionResourceUpdate {
  id: string
  link: string
  tag: string
  cronExp: string
  cronEnable: boolean
  useProxy: boolean
}

interface ProfileUpdateClient {
  patch: (path: string, body?: unknown) => Promise<unknown>
}

interface SubscriptionUpdateClient {
  put: (path: string, body?: unknown) => Promise<unknown>
}

export function updateUserProfile(client: ProfileUpdateClient, update: UserProfileUpdate) {
  return client.patch('/user/me', update)
}

export function updateSubscriptionResource(client: SubscriptionUpdateClient, update: SubscriptionResourceUpdate) {
  const { id, ...body } = update
  return client.put(`/subscriptions/${id}`, body)
}
