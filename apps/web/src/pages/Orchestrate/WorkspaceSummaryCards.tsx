import type {
  ConfigResource,
  GroupListView,
  InterfaceResource,
  NodeLatencyProbeResult,
  NodeResource,
  SubscriptionResource,
} from '~/apis/types'
import { CloudCog, Map, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

function SummaryShell({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  actionLabel: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/96 shadow-[0_10px_24px_rgba(15,23,42,0.055)]">
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--shell-line)]/80 px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/90 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="xs" className="rounded-full" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  )
}

function SummaryHero({
  label,
  value,
  tag,
  note,
  valueClassName,
}: {
  label: string
  value: string
  tag?: string
  note?: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-[18px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/82 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-muted-foreground">{label}</span>
          <strong
            className={cn(
              'mt-1 block truncate text-[1.95rem] font-extrabold leading-none tracking-tight text-foreground',
              valueClassName,
            )}
          >
            {value}
          </strong>
        </div>
        {tag ? (
          <Badge className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-700 hover:bg-emerald-500/12 dark:text-emerald-300">
            {tag}
          </Badge>
        ) : null}
      </div>
      {note ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p> : null}
    </div>
  )
}

function InterfaceStat({
  label,
  items,
}: {
  label: string
  items: Array<{ name: string; address?: string }>
}) {
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/82 px-4 py-3">
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={`${item.name}-${item.address || ''}`} className="min-w-0">
              <strong className="block truncate text-sm font-semibold leading-none text-foreground">{item.name}</strong>
              {item.address ? <span className="block truncate text-xs text-muted-foreground">{item.address}</span> : null}
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/82 px-4 py-3">
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-lg font-extrabold leading-none text-foreground">{value}</strong>
    </div>
  )
}

function SummaryThinList({
  rows,
}: {
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="flex items-center justify-between gap-3 rounded-[14px] border border-[color:var(--shell-line)]/80 bg-[color:var(--shell-surface)]/88 px-3.5 py-2.5"
        >
          <strong className="truncate text-sm font-semibold text-foreground">{row.label}</strong>
          <span className="truncate text-sm text-muted-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function PathPreview({
  source,
  destination,
  latencyLabel,
}: {
  source: { title: string; subtitle: string }
  destination: { title: string; subtitle: string }
  latencyLabel?: string
}) {
  return (
    <div className="rounded-[18px] border border-[color:var(--shell-line)] bg-[color:var(--shell-blue-soft)]/44 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <strong className="block truncate text-base font-semibold text-foreground">{source.title}</strong>
          <span className="block truncate text-sm text-muted-foreground">{source.subtitle}</span>
        </div>
        <div className="text-sm font-semibold text-muted-foreground">→</div>
        <div className="min-w-0">
          <strong className="block truncate text-base font-semibold text-foreground">{destination.title}</strong>
          <span className="block truncate text-sm text-muted-foreground">{destination.subtitle}</span>
        </div>
        {latencyLabel ? (
          <Badge className="rounded-full bg-[color:var(--shell-blue-soft)] px-2.5 py-1 text-[color:var(--shell-blue-strong)] hover:bg-[color:var(--shell-blue-soft)]">
            {latencyLabel}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function NodeRow({
  rank,
  title,
  subtitle,
  latencyLabel,
  warn,
}: {
  rank: number
  title: string
  subtitle: string
  latencyLabel?: string
  warn?: boolean
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/88 px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-emerald-500/12 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
        {rank}
      </span>
      <div className="min-w-0">
        <strong className="block truncate text-sm font-semibold text-foreground">{title}</strong>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </div>
      {latencyLabel ? (
        <Badge
          className={cn(
            'rounded-full px-2.5 py-1 text-xs',
            warn
              ? 'bg-orange-500/12 text-orange-700 hover:bg-orange-500/12 dark:text-orange-300'
              : 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/12 dark:text-emerald-300',
          )}
        >
          {latencyLabel}
        </Badge>
      ) : null}
    </div>
  )
}

function StatusRow({
  title,
  subtitle,
  badge,
}: {
  title: string
  subtitle: string
  badge: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/88 px-3 py-2.5">
      <strong className="truncate text-sm font-semibold text-foreground">{title}</strong>
      <span className="truncate text-sm text-muted-foreground">{subtitle}</span>
      <Badge className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-700 hover:bg-emerald-500/12 dark:text-emerald-300">
        {badge}
      </Badge>
    </div>
  )
}

function SummarySplitActions({
  leftLabel,
  rightLabel,
  onLeft,
  onRight,
}: {
  leftLabel: string
  rightLabel: string
  onLeft?: () => void
  onRight?: () => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        className="flex items-center justify-between rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/82 px-3.5 py-3 text-sm font-semibold text-foreground"
        onClick={onLeft}
      >
        <span>{leftLabel}</span>
        <span className="text-muted-foreground">›</span>
      </button>
      <button
        type="button"
        className="flex items-center justify-between rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface-soft)]/82 px-3.5 py-3 text-sm font-semibold text-foreground"
        onClick={onRight}
      >
        <span>{rightLabel}</span>
        <span className="text-muted-foreground">›</span>
      </button>
    </div>
  )
}

function formatLatencyLabel(result?: NodeLatencyProbeResult) {
  if (!result || typeof result.latencyMs !== 'number') return undefined
  return `${result.latencyMs} ms`
}

function getTopNodes(nodes: NodeResource[], nodeLatencies?: Record<string, NodeLatencyProbeResult>) {
  return [...nodes]
    .map((node) => ({
      node,
      latency: nodeLatencies?.[node.id]?.latencyMs ?? Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left.latency - right.latency)
    .slice(0, 3)
}

export function WorkspaceSummaryCards({
  selectedConfig,
  configs,
  groups,
  defaultGroupID,
  sortedNodes,
  subscriptions,
  interfaces,
  nodeLatencies,
  onOpenConfig,
  onOpenGroup,
  onOpenNodes,
  onOpenSubscriptions,
}: {
  selectedConfig?: ConfigResource
  configs: ConfigResource[]
  groups: GroupListView['groups']
  defaultGroupID?: string
  sortedNodes: NodeResource[]
  subscriptions: SubscriptionResource[]
  interfaces: InterfaceResource[]
  nodeLatencies?: Record<string, NodeLatencyProbeResult>
  onOpenConfig?: () => void
  onOpenGroup?: () => void
  onOpenNodes?: () => void
  onOpenSubscriptions?: () => void
}) {
  const { t } = useTranslation()

  const activeConfig = selectedConfig ?? configs[0]
  const defaultGroup = groups.find((group) => group.id === defaultGroupID) ?? groups[0]
  const defaultGroupNode = defaultGroup?.nodes[0]
  const defaultGroupSubscriptionNode = defaultGroup?.subscriptions[0]?.matchedNodes[0]
  const pathDestination = defaultGroupNode ?? defaultGroupSubscriptionNode
  const topNodes = getTopNodes(sortedNodes, nodeLatencies)
  const topSubscriptions = subscriptions.slice(0, 2)
  const manualNodeCount = sortedNodes.filter((node) => !node.subscriptionID).length

  const wanInterfaceItems = (activeConfig?.global.wanInterface ?? []).flatMap((value) => {
    if (value === 'auto') {
      return interfaces
        .filter((iface) => iface.defaultRoutes && iface.defaultRoutes.length > 0)
        .map((iface) => ({
          name: iface.name,
          address: iface.addresses[0],
        }))
    }

    const iface = interfaces.find((item) => item.name === value)
    return iface ? [{ name: iface.name, address: iface.addresses[0] }] : [{ name: value }]
  })
  const lanInterfaceItems = (activeConfig?.global.lanInterface ?? []).map((value) => {
    const iface = interfaces.find((item) => item.name === value)
    return iface ? { name: iface.name, address: iface.addresses[0] } : { name: value }
  })

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.28fr)_minmax(0,0.98fr)]">
      <SummaryShell
        title={t('config')}
        subtitle={t('workspaceSummary.configSubtitle')}
        icon={<Settings className="h-4.5 w-4.5" />}
        actionLabel={t('actions.settings')}
        onAction={onOpenConfig}
      >
        <SummaryHero
          label={t('workspaceSummary.currentConfig')}
          value={activeConfig?.name || 'default'}
          tag={t('workspaceSummary.applied')}
          valueClassName="text-[1.55rem]"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <SummaryStat label={t('tproxyPort')} value={String(activeConfig?.global.tproxyPort ?? '—')} />
          <SummaryStat label={t('dialMode')} value={activeConfig?.global.dialMode || '—'} />
          <InterfaceStat label={t('wanInterface')} items={wanInterfaceItems} />
          <InterfaceStat label={t('lanInterface')} items={lanInterfaceItems} />
        </div>
        <SummaryThinList
          rows={[
            { label: t('workspaceSummary.fallbackDns'), value: activeConfig?.global.fallbackResolver || '—' },
          ]}
        />
      </SummaryShell>

      <SummaryShell
        title={t('group')}
        subtitle={t('workspaceSummary.groupSubtitle')}
        icon={<Map className="h-4.5 w-4.5" />}
        actionLabel={t('actions.viewDetails')}
        onAction={onOpenGroup}
      >
        <SummaryHero
          label={t('workspaceSummary.defaultGroup')}
          value={defaultGroup?.name || '—'}
          tag={defaultGroup?.policy || '—'}
        />
        {defaultGroup && pathDestination ? (
          <PathPreview
            source={{ title: defaultGroup.name, subtitle: t('workspaceSummary.currentGroup') }}
            destination={{
              title: pathDestination.tag || pathDestination.name || '—',
              subtitle: pathDestination.subscriptionID ? t('workspaceSummary.fromSubscription') : t('workspaceSummary.manualNode'),
            }}
            latencyLabel={formatLatencyLabel(nodeLatencies?.[pathDestination.id])}
          />
        ) : null}
        <SummaryThinList
          rows={groups.slice(0, 3).map((group) => ({
            label: group.name,
            value: `${group.policy} · ${(group.nodes[0]?.tag || group.subscriptions[0]?.matchedNodes[0]?.name || '—') as string}`,
          }))}
        />
      </SummaryShell>

      <SummaryShell
        title={t('workspaceSummary.nodeSubscriptionTitle')}
        subtitle={t('workspaceSummary.nodeSubscriptionSubtitle')}
        icon={<CloudCog className="h-4.5 w-4.5" />}
        actionLabel={t('latency.testAllNodes')}
        onAction={onOpenNodes}
      >
        <div className="space-y-2">
          {topNodes.map(({ node, latency }, index) => (
            <NodeRow
              key={node.id}
              rank={index + 1}
              title={node.name || node.tag || node.address}
              subtitle={`${node.protocol}${node.address ? ` · ${node.address}` : ''}`}
              latencyLabel={Number.isFinite(latency) ? `${latency} ms` : undefined}
              warn={latency >= 80}
            />
          ))}
        </div>
        <div className="space-y-2">
          {topSubscriptions.map((subscription) => (
            <StatusRow
              key={subscription.id}
              title={subscription.tag || subscription.link}
              subtitle={`${t('workspaceSummary.subscriptionUpdated')} · ${subscription.nodes.items.length} ${t('node')}`}
              badge={t('workspaceSummary.healthy')}
            />
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-[color:var(--shell-line)] bg-[color:var(--shell-surface)]/88 px-3 py-2.5">
            <strong className="truncate text-sm font-semibold text-foreground">{t('workspaceSummary.manualNodes')}</strong>
            <span className="text-sm text-muted-foreground">{manualNodeCount}</span>
          </div>
        </div>
        <SummarySplitActions
          leftLabel={t('node')}
          rightLabel={t('subscription')}
          onLeft={onOpenNodes}
          onRight={onOpenSubscriptions}
        />
      </SummaryShell>
    </section>
  )
}
