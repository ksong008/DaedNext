import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'

import { MainLayout } from '~/pages/MainLayout'

const OrchestratePage = lazy(async () => {
  const module = await import('~/pages/Orchestrate')
  return { default: module.OrchestratePage }
})

const SetupPage = lazy(async () => {
  const module = await import('~/pages/Setup')
  return { default: module.SetupPage }
})

function RouteFallback() {
  return <div className="min-h-dvh bg-pattern" />
}

export function Router() {
  const RouterType = import.meta.env.DEV ? BrowserRouter : HashRouter

  return (
    <RouterType>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<OrchestratePage />} />
          </Route>

          <Route path="/setup" element={<SetupPage />} />
        </Routes>
      </Suspense>
    </RouterType>
  )
}
