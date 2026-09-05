import { useStore } from '@nanostores/react'
import { isMockMode } from '~/mocks'
import { tokenAtom } from '~/store'

export function useAuthenticatedQueryEnabled(enabled = true) {
  const token = useStore(tokenAtom)
  return enabled && (isMockMode() || !!token)
}

export interface CountResponse {
  updated?: number
  removed?: number
}

export interface ResourceWithID {
  id: number
}
