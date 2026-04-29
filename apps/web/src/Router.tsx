import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'

import { MainLayout, OrchestratePage, SetupPage } from '~/pages'

export function Router() {
  const RouterType = import.meta.env.DEV ? BrowserRouter : HashRouter

  return (
    <RouterType>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<OrchestratePage />} />
        </Route>

        <Route path="/setup" element={<SetupPage />} />
      </Routes>
    </RouterType>
  )
}
