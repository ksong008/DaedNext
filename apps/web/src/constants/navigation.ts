import type { LucideIcon } from 'lucide-react'
import { Activity, Cloud, CloudCog, Globe2, Route, Settings, Table2 } from 'lucide-react'

export const ORCHESTRATE_SECTION_IDS = {
  overview: 'overview',
  config: 'config',
  dns: 'dns',
  routing: 'routing',
  group: 'group',
  node: 'node',
  subscription: 'subscription',
} as const

export type OrchestrateSectionKey = keyof typeof ORCHESTRATE_SECTION_IDS
export type OrchestrateSectionId = (typeof ORCHESTRATE_SECTION_IDS)[OrchestrateSectionKey]
export type ShellNavLabelKey = 'shell.overview' | 'config' | 'dns' | 'routing' | 'group' | 'node' | 'subscription'
export type ShellNavGroupLabelKey = 'shell.groups.monitor' | 'shell.groups.resources'

export interface ShellNavItem {
  key: OrchestrateSectionKey
  id: OrchestrateSectionId
  labelKey: ShellNavLabelKey
  icon: LucideIcon
}

export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  {
    key: 'overview',
    id: ORCHESTRATE_SECTION_IDS.overview,
    labelKey: 'shell.overview',
    icon: Activity,
  },
  {
    key: 'config',
    id: ORCHESTRATE_SECTION_IDS.config,
    labelKey: 'config',
    icon: Settings,
  },
  {
    key: 'dns',
    id: ORCHESTRATE_SECTION_IDS.dns,
    labelKey: 'dns',
    icon: Globe2,
  },
  {
    key: 'routing',
    id: ORCHESTRATE_SECTION_IDS.routing,
    labelKey: 'routing',
    icon: Route,
  },
  {
    key: 'group',
    id: ORCHESTRATE_SECTION_IDS.group,
    labelKey: 'group',
    icon: Table2,
  },
  {
    key: 'node',
    id: ORCHESTRATE_SECTION_IDS.node,
    labelKey: 'node',
    icon: Cloud,
  },
  {
    key: 'subscription',
    id: ORCHESTRATE_SECTION_IDS.subscription,
    labelKey: 'subscription',
    icon: CloudCog,
  },
]

export const SHELL_NAV_GROUPS: Array<{ labelKey: ShellNavGroupLabelKey; items: OrchestrateSectionKey[] }> = [
  {
    labelKey: 'shell.groups.monitor',
    items: ['overview'],
  },
  {
    labelKey: 'shell.groups.resources',
    items: ['config', 'dns', 'routing', 'group', 'node', 'subscription'],
  },
]

export const SHELL_MOBILE_PRIMARY_ITEMS: OrchestrateSectionKey[] = [
  'overview',
  'config',
  'group',
  'node',
  'subscription',
]
