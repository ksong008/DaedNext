import { useStore } from '@nanostores/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, use, useEffect, useMemo } from 'react'

import { APIClient, type APIClientInterface, normalizeEndpointURL } from '~/apis/client'
import { isMockMode, MockAPIClient } from '~/mocks'
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
