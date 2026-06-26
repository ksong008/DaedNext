import type { ComponentType } from 'react'
import type { OrchestrateSectionKey } from '~/constants'
import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'

import { useGeneralStateQuery, useNodesQuery } from '~/apis'
import { HeaderWithActions } from '~/components/Header'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '~/components/ui/sidebar'
import { ORCHESTRATE_SECTION_IDS, SHELL_MOBILE_PRIMARY_ITEMS, SHELL_NAV_GROUPS, SHELL_NAV_ITEMS } from '~/constants'
import { useInitialize } from '~/initialize'
import { cn } from '~/lib/utils'
import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'

function ShellNavButton({
  active,
  badge,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean
  badge?: string
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <SidebarMenuButton
      isActive={active}
      onClick={onClick}
      className={cn(
        'h-10 rounded-xl border border-transparent px-2.5 text-[0.95rem] font-semibold text-sidebar-foreground/75 transition-all',
        'hover:border-sidebar-border hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground',
        'data-[active=true]:border-sidebar-primary/25 data-[active=true]:bg-sidebar-primary/10 data-[active=true]:text-sidebar-primary',
      )}
      tooltip={label}
      type="button"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-sidebar-accent/75 text-current">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-full bg-sidebar-accent/75 px-2 py-0.5 text-[11px] font-bold text-sidebar-foreground/60">
          {badge}
        </span>
      )}
    </SidebarMenuButton>
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
  const [activeSection, setActiveSection] = useState<OrchestrateSectionKey>('overview')
  const { data: generalStateQuery } = useGeneralStateQuery()
  const { data: nodesQuery } = useNodesQuery()
  const manualNodeCount = nodesQuery?.nodes.totalCount ?? nodesQuery?.nodes.items.length ?? 0

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
    if (isMockMode()) return

    if (!endpointURL || !token) {
      navigate('/setup')
    }
  }, [endpointURL, navigate, token])

  const navCountBySection = useMemo(
    () => ({
      overview: t('shell.live'),
      log: '',
      config: String(generalStateQuery?.general.counts.configs ?? 0),
      dns: String(generalStateQuery?.general.counts.dns ?? 0),
      routing: String(generalStateQuery?.general.counts.routings ?? 0),
      group: String(generalStateQuery?.general.counts.groups ?? 0),
      node: String(manualNodeCount),
      subscription: String(generalStateQuery?.general.counts.subscriptions ?? 0),
    }),
    [generalStateQuery?.general.counts, manualNodeCount, t],
  )

  const navItemByKey = useMemo(
    () =>
      Object.fromEntries(SHELL_NAV_ITEMS.map((item) => [item.key, item])) as Record<
        OrchestrateSectionKey,
        (typeof SHELL_NAV_ITEMS)[number]
      >,
    [],
  )

  const sectionKeyById = useMemo(
    () =>
      Object.fromEntries(SHELL_NAV_ITEMS.map((item) => [item.id, item.key])) as Record<string, OrchestrateSectionKey>,
    [],
  )

  const activePanelSection = useMemo(() => {
    const value = searchParams.get('panel')
    if (!value || value === 'overview') return null
    return SHELL_NAV_ITEMS.some((item) => item.key === value) ? (value as OrchestrateSectionKey) : null
  }, [searchParams])

  const scrollToSection = useCallback(
    (sectionKey: OrchestrateSectionKey) => {
      const nextSearchParams = new URLSearchParams(searchParams)

      if (sectionKey !== 'overview') {
        nextSearchParams.set('panel', sectionKey)
        setSearchParams(nextSearchParams, { replace: true })
        setActiveSection(sectionKey)
        return
      }

      nextSearchParams.delete('panel')
      setSearchParams(nextSearchParams, { replace: true })

      const sectionId = ORCHESTRATE_SECTION_IDS[sectionKey]
      const element = document.getElementById(sectionId)
      if (!element) return

      const targetTop = element.getBoundingClientRect().top + window.scrollY - 116
      setActiveSection(sectionKey)
      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: 'smooth',
      })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    if (activePanelSection) {
      setActiveSection(activePanelSection)
      return
    }
    setActiveSection('overview')
  }, [activePanelSection])

  useEffect(() => {
    if (activePanelSection) return

    const sectionIds = Object.values(ORCHESTRATE_SECTION_IDS)
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => !!element)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

        if (visibleEntries.length === 0) return

        const nextKey = sectionKeyById[visibleEntries[0].target.id]
        if (nextKey) {
          setActiveSection(nextKey)
        }
      },
      {
        rootMargin: '-22% 0px -55% 0px',
        threshold: [0.12, 0.3, 0.5, 0.75],
      },
    )

    for (const element of elements) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [activePanelSection, sectionKeyById])

  return (
    <div className="daed-shell min-h-screen">
      <SidebarProvider defaultOpen>
        <Sidebar
          side="left"
          collapsible="offcanvas"
          className="border-r border-sidebar-border bg-[color:var(--shell-sidebar)] backdrop-blur-[22px] supports-[backdrop-filter]:bg-[color:var(--shell-sidebar)]/92 [&_[data-slot=sidebar-inner]]:bg-[color:var(--shell-sidebar)]"
        >
          <SidebarHeader className="px-4 pb-3 pt-5">
            <div className="flex items-center gap-3">
              <img
                src="/logo.webp"
                alt="DAED"
                className="h-11 w-11 rounded-xl border border-sidebar-border object-cover shadow-[0_8px_18px_color-mix(in_oklab,var(--sidebar-foreground)_12%,transparent)]"
              />
              <div className="min-w-0">
                <p className="truncate text-[1.65rem] font-semibold leading-none text-sidebar-foreground">DAED</p>
                <p className="mt-1 truncate text-sm font-semibold text-sidebar-foreground/60">
                  {import.meta.env.APP_VERSION}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-3 px-3 pb-6">
            {SHELL_NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.labelKey} className="p-0">
                <SidebarGroupLabel className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                  {t(group.labelKey)}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((sectionKey) => {
                      const item = navItemByKey[sectionKey]
                      return (
                        <SidebarMenuItem key={item.key}>
                          <ShellNavButton
                            active={activeSection === item.key}
                            badge={navCountBySection[item.key]}
                            label={t(item.labelKey)}
                            icon={item.icon}
                            onClick={() => scrollToSection(item.key)}
                          />
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="min-h-screen bg-transparent">
          <HeaderWithActions />
          <main className="flex-1">
            <div
              className={cn(
                'mx-auto flex w-full flex-col gap-3 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 sm:gap-4 sm:px-5 sm:pt-4 lg:px-7 lg:pb-10',
                activePanelSection === 'log' ? 'max-w-none' : 'max-w-[1480px]',
              )}
            >
              <Outlet />
            </div>
          </main>

          <nav className="shell-mobile-nav md:hidden" aria-label={t('shell.groups.monitor')}>
            {SHELL_MOBILE_PRIMARY_ITEMS.map((sectionKey) => {
              const item = navItemByKey[sectionKey]
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    'shell-mobile-nav-item flex min-h-9 flex-col items-center justify-center rounded-xl px-1 py-0.5 text-[10px] font-semibold leading-none transition-colors',
                    activeSection === item.key
                      ? 'bg-sidebar-primary/7 text-sidebar-primary'
                      : 'text-sidebar-foreground/52 hover:text-sidebar-foreground/75',
                  )}
                  onClick={() => scrollToSection(item.key)}
                >
                  <Icon className="mb-0.5 h-3.5 w-3.5" />
                  <span className="max-w-full truncate">{t(item.labelKey)}</span>
                </button>
              )
            })}
          </nav>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
