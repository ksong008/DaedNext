import type { CurrentUserView } from '../types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAPIClient } from '~/contexts'
import { webQueryKeys } from '../query_cache'
import { useAuthenticatedQueryEnabled } from './shared'

export function useUserQuery() {
  const apiClient = useAPIClient()
  const enabled = useAuthenticatedQueryEnabled()

  return useQuery({
    queryKey: webQueryKeys.user(),
    queryFn: async ({ signal }): Promise<CurrentUserView> => {
      const user = await apiClient.get<CurrentUserView['user']>('/user/me', undefined, { signal })
      return { user }
    },
    enabled,
  })
}

export interface TokenResponse {
  token: string
}

export function useUpdatePasswordMutation() {
  const apiClient = useAPIClient()

  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const response = await apiClient.post<TokenResponse>('/user/me/password', {
        currentPassword,
        newPassword,
      })
      return response.token
    },
  })
}
