import type { ComponentProps } from 'react'
import type { OrchestrateSectionKey } from '~/constants'
import { useStore } from '@nanostores/react'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useGeneralStateQuery, useNodesQuery } from '~/apis'
import { BrandMark } from '~/components/BrandMark'
import { HeaderWithActions } from '~/components/Header'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '~/components/ui/sidebar'
import { SHELL_MOBILE_PRIMARY_ITEMS, SHELL_NAV_GROUPS, SHELL_NAV_ITEMS } from '~/constants'
import { useInitialize } from '~/initialize'
import { cn } from '~/lib/utils'
import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'

function NavigationButton(props: ComponentProps<typeof SidebarMenuButton>) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuButton
      {...props}
      onClick={(event) => {
        setOpenMobile(false)
        props.onClick?.(event)
      }}
    />
  )
}

export function MainLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const token = useStore(tokenAtom)
  const endpointURL = useStore(endpointURLAtom)
  const initialize = useInitialize()
  const initializedRuntimeKeyRef = useRef<string | null>(null)
  const { data: generalStateQuery } = useGeneralStateQuery()
  const { data: nodesQuery } = useNodesQuery()
  const panel = searchParams.get('panel')
  const activeItem = SHELL_NAV_ITEMS.find((item) => item.key === panel) ?? SHELL_NAV_ITEMS[0]
  const activeSection = activeItem.key
  const counts = generalStateQuery?.general.counts
  const running = generalStateQuery?.general.dae.running
  const navCounts: Partial<Record<OrchestrateSectionKey, number>> = {
    config: counts?.configs,
    dns: counts?.dns,
    routing: counts?.routings,
    group: counts?.groups,
    node: nodesQuery?.nodes.totalCount ?? nodesQuery?.nodes.items.length,
    subscription: counts?.subscriptions,
  }

  useEffect(() => {
    if (isMockMode()) {
      if (initializedRuntimeKeyRef.current === 'mock') return
      initializedRuntimeKeyRef.current = 'mock'
      void initialize()
      return
    }
    if (!endpointURL || !token) {
      initializedRuntimeKeyRef.current = null
      navigate('/setup')
      return
    }
    const key = `${endpointURL}::${token}`
    if (initializedRuntimeKeyRef.current === key) return
    initializedRuntimeKeyRef.current = key
    void initialize()
  }, [endpointURL, initialize, navigate, token])

  const openSection = useCallback(
    (section: OrchestrateSectionKey) => {
      const next = new URLSearchParams(searchParams)
      if (section === 'overview') next.delete('panel')
      else next.set('panel', section)
      setSearchParams(next)
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    [searchParams, setSearchParams],
  )

  return (
    <div className="daed-shell min-h-screen">
      <a
        className="skip-link"
        href="#workspace-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('workspace-main')?.focus()
        }}
      >
        {t('design.skipToContent')}
      </a>
      <SidebarProvider defaultOpen>
        <Sidebar
          collapsible="offcanvas"
          className="border-r border-sidebar-border [&_[data-slot=sidebar-inner]]:bg-sidebar"
        >
          <SidebarHeader className="px-6 pb-8 pt-8">
            <button
              type="button"
              onClick={() => openSection('overview')}
              className="flex items-center gap-3 text-left text-sidebar-foreground"
              aria-label={t('shell.overview')}
            >
              <BrandMark className="text-sidebar-primary" />
              <span>
                <span className="block text-xl font-semibold tracking-tight">
                  Daed<span className="font-normal text-sidebar-primary">Next</span>
                </span>
                <span className="block pt-1 font-mono text-[10px] tracking-[0.17em] text-sidebar-foreground/60">
                  NETWORK CONSOLE
                </span>
              </span>
            </button>
          </SidebarHeader>
          <SidebarContent className="gap-6 px-3">
            {SHELL_NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.labelKey} className="p-0">
                <SidebarGroupLabel className="px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/55">
                  {t(group.labelKey)}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {group.items.map((key) => {
                      const item = SHELL_NAV_ITEMS.find((entry) => entry.key === key)!
                      const Icon = item.icon
                      return (
                        <SidebarMenuItem key={key}>
                          <NavigationButton
                            type="button"
                            isActive={activeSection === key}
                            aria-current={activeSection === key ? 'page' : undefined}
                            onClick={() => openSection(key)}
                            className="console-nav-button h-11 rounded-lg px-3 text-[13px]"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="flex-1">{t(item.labelKey)}</span>
                            {navCounts[key] !== undefined && (
                              <span className="font-mono text-[11px] opacity-60">
                                {String(navCounts[key]).padStart(2, '0')}
                              </span>
                            )}
                            {activeSection === key && <ChevronRight className="h-3 w-3 opacity-70" />}
                          </NavigationButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter className="gap-4 px-6 py-6">
            <div className="flex items-center gap-2 border-t border-sidebar-border pt-5 text-xs text-sidebar-foreground/75">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  running === true ? 'bg-sidebar-primary' : 'bg-sidebar-foreground/40',
                )}
              />
              {running === undefined ? '—' : t(running ? 'shell.running' : 'shell.stopped')}
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-sidebar-foreground/50">
              <span>{import.meta.env.APP_VERSION}</span>
              <span>DAE / NEXT</span>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-h-screen min-w-0 bg-transparent">
          <HeaderWithActions />
          <main id="workspace-main" tabIndex={-1} className="flex-1 outline-none">
            <div className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-6 sm:px-7 lg:px-9 lg:pb-10 lg:pt-8">
              <div className="workspace-heading">
                <div>
                  <p className="console-eyebrow">
                    <span className="text-primary">
                      {String(SHELL_NAV_ITEMS.indexOf(activeItem) + 1).padStart(2, '0')}
                    </span>
                    <span>/</span>
                    {t('design.workspace')}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[30px]">
                    {t(activeItem.labelKey)}
                  </h1>
                  {activeSection !== 'overview' && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`design.descriptions.${activeSection}`)}
                    </p>
                  )}
                </div>
                {activeSection === 'overview' && (
                  <button type="button" className="console-shortcut" onClick={() => openSection('routing')}>
                    {t('design.viewRouting')}
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Outlet />
            </div>
          </main>
          <nav className="shell-mobile-nav md:hidden" aria-label={t('design.workspace')}>
            {SHELL_MOBILE_PRIMARY_ITEMS.map((key) => {
              const item = SHELL_NAV_ITEMS.find((entry) => entry.key === key)!
              const Icon = item.icon
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={activeSection === key ? 'page' : undefined}
                  onClick={() => openSection(key)}
                  className={cn('shell-mobile-nav-item', activeSection === key && 'is-active')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(item.labelKey)}</span>
                </button>
              )
            })}
          </nav>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
