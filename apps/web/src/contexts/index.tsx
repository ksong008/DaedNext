import type { APIClientInterface } from '~/apis/client'
import { useStore } from '@nanostores/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createContext, use, useEffect, useMemo } from 'react'
import { APIClient, buildAPIURL, normalizeEndpointURL } from '~/apis/client'
import { isMockMode, MockAPIClient } from '~/mocks'
import { PAGE_INSTANCE_HEADER, pageInstanceId, registerPageRetireHandler, retirePageOwners } from '~/page_lifecycle'
import { endpointURLAtom, tokenAtom } from '~/store'

export type APIClientType = APIClientInterface

export const APIClientContext = createContext<APIClientType>(null as unknown as APIClientType)

export function APIClientProvider({ client, children }: { client: APIClientType; children: React.ReactNode }) {
  return <APIClientContext value={client}>{children}</APIClientContext>
}

export const useAPIClient = () => use(APIClientContext)

type ColorScheme = 'dark' | 'light'
type ThemeMode = 'system' | 'light' | 'dark'

interface ColorSchemeContextValue {
  colorScheme: ColorScheme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export const ColorSchemeContext = createContext<ColorSchemeContextValue>({
  colorScheme: 'light',
  themeMode: 'system',
  setThemeMode: () => {},
})

export const useColorScheme = () => use(ColorSchemeContext)

interface QueryProviderProps {
  children: React.ReactNode
  colorScheme: ColorScheme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export function QueryProvider({ children, colorScheme, themeMode, setThemeMode }: QueryProviderProps) {
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
    [],
  )

  useEffect(() => {
    const normalizedEndpointURL = normalizeEndpointURL(endpointURL)
    if (normalizedEndpointURL !== endpointURL) {
      endpointURLAtom.set(normalizedEndpointURL)
    }
  }, [endpointURL])

  const apiClient = useMemo<APIClientType>(() => {
    const normalizedEndpointURL = normalizeEndpointURL(endpointURL)
    if (isMockMode()) {
      return new MockAPIClient(normalizedEndpointURL)
    }
    return new APIClient(normalizedEndpointURL, token)
  }, [endpointURL, token])

  useEffect(() => {
    if (!token || isMockMode()) return
    const heartbeat = new AbortController()
    const touch = () => {
      void apiClient
        .post('/ui/session', undefined, undefined, {
          signal: heartbeat.signal,
          suppressErrorToast: true,
          timeoutMs: 5_000,
        })
        .catch(() => undefined)
    }
    touch()
    const timer = window.setInterval(touch, 3_000)
    const unregisterRetireHandler = registerPageRetireHandler(() => {
      heartbeat.abort()
      window.clearInterval(timer)
    })
    return () => {
      unregisterRetireHandler()
      heartbeat.abort()
      window.clearInterval(timer)
    }
  }, [apiClient, token])

  useEffect(() => {
    const closeHint = () => {
      if (!token || isMockMode()) return
      const url = buildAPIURL(normalizeEndpointURL(endpointURL), '/ui/session/close')
      void fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          [PAGE_INSTANCE_HEADER]: pageInstanceId(),
        },
        keepalive: true,
      }).catch(() => undefined)
    }
    const retire = (event: PageTransitionEvent) => {
      if (event.persisted) return
      closeHint()
      void queryClient.cancelQueries()
      queryClient.clear()
      retirePageOwners()
    }
    window.addEventListener('pagehide', retire)
    return () => window.removeEventListener('pagehide', retire)
  }, [endpointURL, queryClient, token])

  const colorSchemeContextValue = useMemo(
    () => ({ colorScheme, themeMode, setThemeMode }),
    [colorScheme, themeMode, setThemeMode],
  )

  return (
    <ColorSchemeContext value={colorSchemeContextValue}>
      <QueryClientProvider client={queryClient}>
        <APIClientProvider client={apiClient}>{children}</APIClientProvider>
      </QueryClientProvider>
    </ColorSchemeContext>
  )
}
