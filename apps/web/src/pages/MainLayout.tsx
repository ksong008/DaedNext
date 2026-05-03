import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import { HeaderWithActions } from '~/components/Header'
import { useInitialize } from '~/initialize'
import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'

export function MainLayout() {
  const navigate = useNavigate()
  const token = useStore(tokenAtom)
  const endpointURL = useStore(endpointURLAtom)
  const initialize = useInitialize()
  const initializedRuntimeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (isMockMode()) {
      if (initializedRuntimeKeyRef.current === 'mock') return
      initializedRuntimeKeyRef.current = 'mock'
      void initialize()
      return
    }

    if (!endpointURL || !token) {
      initializedRuntimeKeyRef.current = null
      return
    }

    const runtimeKey = `${endpointURL}::${token}`
    if (initializedRuntimeKeyRef.current === runtimeKey) return
    initializedRuntimeKeyRef.current = runtimeKey
    void initialize()
  }, [endpointURL, initialize, token])

  useEffect(() => {
    // Skip authentication check in mock mode
    if (isMockMode()) return

    if (!endpointURL || !token) {
      navigate('/setup')
    }
  }, [endpointURL, navigate, token])

  return (
    <div className="flex min-h-screen flex-col bg-pattern">
      <HeaderWithActions />
      <main className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
      <footer className="h-14 border-t bg-card/50 backdrop-blur-sm flex items-center justify-center">
        <p className="text-xs text-muted-foreground font-light tracking-wide">
          Made with <span className="inline-block animate-pulse text-primary">●</span> by{' '}
          <a
            href="https://github.com/daeuniverse"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline underline-offset-4 transition-colors hover:text-primary/80"
          >
            @daeuniverse
          </a>
        </p>
      </footer>
    </div>
  )
}
