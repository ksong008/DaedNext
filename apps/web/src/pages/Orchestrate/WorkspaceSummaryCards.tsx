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
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

const summaryShellStyle = {
  background: 'color-mix(in oklab, var(--card) 94%, var(--primary) 6%)',
  borderColor: 'color-mix(in oklab, var(--border) 78%, var(--primary) 22%)',
  boxShadow: '0 10px 24px color-mix(in oklab, var(--foreground) 7%, transparent)',
}

function SummaryShell({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  actionDisabled,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  actionLabel: string
  onAction?: () => void | Promise<void>
  actionDisabled?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border" style={summaryShellStyle}>
      <div className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="xs" className="rounded-full" disabled={actionDisabled} onClick={onAction}>
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
    <div className="rounded-[18px] border border-border bg-accent/45 p-4">
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
          <Badge className="rounded-full bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/10">{tag}</Badge>
        ) : null}
      </div>
      {note ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p> : null}
    </div>
  )
}

function InterfaceStat({ label, items }: { label: string; items: Array<{ name: string; address?: string }> }) {
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-[16px] border border-border bg-accent/40 px-4 py-3">
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={`${item.name}-${item.address || ''}`} className="min-w-0">
              <strong className="block truncate text-sm font-semibold leading-none text-foreground">{item.name}</strong>
              {item.address ? (
                <span className="block truncate text-xs text-muted-foreground">{item.address}</span>
              ) : null}
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-[16px] border border-border bg-accent/40 px-4 py-3">
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-lg font-extrabold leading-none text-foreground">{value}</strong>
    </div>
  )
}

function SummaryThinList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="flex items-center justify-between gap-3 rounded-[14px] border border-border/80 bg-card/80 px-3.5 py-2.5"
        >
          <strong className="truncate text-sm font-semibold text-foreground">{row.label}</strong>
          <span className="truncate text-sm text-muted-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function CurrentGroupPathCard({
  groupName,
  currentLabel,
  policy,
  policyLabel,
  destination,
  latencyTitle,
  latencyLabel,
}: {
  groupName: string
  currentLabel: string
  policy?: string
  policyLabel: string
  destination?: { title: string; subtitle: string; tooltipNodes?: string[] }
  latencyTitle: string
  latencyLabel?: string
}) {
  const destinationContent = (
    <div className={cn('min-w-0', destination?.tooltipNodes?.length ? 'cursor-default' : '')}>
      <span className="block truncate text-xs font-semibold text-muted-foreground">{destination?.subtitle || '—'}</span>
      <strong className="mt-1 block truncate text-[1.08rem] font-extrabold leading-none text-foreground">
        {destination?.title || '—'}
      </strong>
    </div>
  )

  return (
    <article className="rounded-[16px] border border-border bg-accent/35 px-3.5 py-3 shadow-sm">
      <div className="grid grid-cols-[minmax(0,0.86fr)_auto_minmax(0,1.14fr)] items-center gap-3">
        <div className="min-w-0">
          <span className="block truncate text-xs font-semibold text-muted-foreground">{currentLabel}</span>
          <strong className="mt-1 block truncate text-[1.08rem] font-extrabold leading-none text-foreground">
            {groupName}
          </strong>
        </div>

        <div className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-sm font-semibold text-muted-foreground">
          →
        </div>

        {destination?.tooltipNodes?.length ? (
          <Tooltip>
            <TooltipTrigger asChild>{destinationContent}</TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-h-72 w-80 overflow-y-auto p-2 text-xs">
              <div className="mb-2 border-b border-border/70 px-1 pb-1.5 font-semibold text-muted-foreground">
                {destination.subtitle}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {destination.tooltipNodes.map((nodeName, index) => (
                  <div
                    key={`${nodeName}-${index}`}
                    className="max-w-full truncate rounded-md border border-border/60 bg-background/70 px-2 py-1 text-foreground"
                  >
                    {nodeName}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          destinationContent
        )}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border/70 pt-2.5">
        <Badge className="min-w-0 max-w-[12rem] justify-self-start rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/10">
          <span className="mr-1 shrink-0 text-primary/70">{policyLabel}</span>
          <span className="truncate">{policy || '—'}</span>
        </Badge>
        <Badge className="shrink-0 justify-self-end rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground hover:bg-accent">
          <span className="mr-1 opacity-70">{latencyTitle}</span>
          <span>{latencyLabel || '—'}</span>
        </Badge>
      </div>
    </article>
  )
}

function NodeRow({
  rank,
  title,
  subtitle,
  latencyLabel,
  warn,
  muted,
}: {
  rank: number
  title: string
  subtitle: string
  latencyLabel: string
  warn?: boolean
  muted?: boolean
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-border bg-card/80 px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-primary/10 text-xs font-extrabold text-primary">
        {rank}
      </span>
      <div className="min-w-0">
        <strong className="block truncate text-sm font-semibold text-foreground">{title}</strong>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <Badge
        className={cn(
          'rounded-full px-2.5 py-1 text-xs',
          muted
            ? 'bg-muted text-muted-foreground hover:bg-muted'
            : warn
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/10'
              : 'bg-primary/10 text-primary hover:bg-primary/10',
        )}
      >
        {latencyLabel}
      </Badge>
    </div>
  )
}

function StatusRow({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-border bg-card/80 px-3 py-2.5">
      <strong className="truncate text-sm font-semibold text-foreground">{title}</strong>
      <span className="truncate text-sm text-muted-foreground">{subtitle}</span>
      <Badge className="rounded-full bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/10">{badge}</Badge>
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
        className="flex items-center justify-between rounded-[16px] border border-border bg-accent/40 px-3.5 py-3 text-sm font-semibold text-foreground"
        onClick={onLeft}
      >
        <span>{leftLabel}</span>
        <span className="text-muted-foreground">›</span>
      </button>
      <button
        type="button"
        className="flex items-center justify-between rounded-[16px] border border-border bg-accent/40 px-3.5 py-3 text-sm font-semibold text-foreground"
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

function formatBestLatencyLabel(nodes: NodeResource[], nodeLatencies?: Record<string, NodeLatencyProbeResult>) {
  const latencies = nodes
    .map((node) => nodeLatencies?.[node.id]?.latencyMs)
    .filter((latency): latency is number => typeof latency === 'number')

  if (latencies.length === 0) return undefined

  return `${Math.min(...latencies)} ms`
}

function getNodeDisplayName(node: NodeResource) {
  return node.tag || node.name || node.address || '—'
}

interface RankedNode {
  node: NodeResource
  latency: number
  source: { type: 'manual' } | { type: 'subscription'; name: string }
}

function getTopNodes(
  nodes: NodeResource[],
  subscriptions: SubscriptionResource[],
  nodeLatencies?: Record<string, NodeLatencyProbeResult>,
): RankedNode[] {
  const rankedNodes: RankedNode[] = []
  const seenNodeIds = new Set<string>()

  for (const node of nodes) {
    rankedNodes.push({
      node,
      latency: nodeLatencies?.[node.id]?.latencyMs ?? Number.POSITIVE_INFINITY,
      source: { type: 'manual' },
    })
    seenNodeIds.add(node.id)
  }

  for (const subscription of subscriptions) {
    for (const node of subscription.nodes.items) {
      if (seenNodeIds.has(node.id)) continue

      rankedNodes.push({
        node,
        latency: nodeLatencies?.[node.id]?.latencyMs ?? Number.POSITIVE_INFINITY,
        source: { type: 'subscription', name: subscription.tag || subscription.link },
      })
      seenNodeIds.add(node.id)
    }
  }

  return rankedNodes.sort((left, right) => left.latency - right.latency).slice(0, 3)
}

export function WorkspaceSummaryCards({
  selectedConfig,
  configs,
  groups,
  sortedNodes,
  subscriptions,
  interfaces,
  nodeLatencies,
  onOpenConfig,
  onOpenGroup,
  onOpenNodes,
  onOpenSubscriptions,
  onTestAllNodeLatencies,
  testingLatencies,
  testingLatencyProgress,
}: {
  selectedConfig?: ConfigResource
  configs: ConfigResource[]
  groups: GroupListView['groups']
  sortedNodes: NodeResource[]
  subscriptions: SubscriptionResource[]
  interfaces: InterfaceResource[]
  nodeLatencies?: Record<string, NodeLatencyProbeResult>
  onOpenConfig?: () => void
  onOpenGroup?: () => void
  onOpenNodes?: () => void
  onOpenSubscriptions?: () => void
  onTestAllNodeLatencies?: () => void | Promise<void>
  testingLatencies?: boolean
  testingLatencyProgress?: { completed: number; total: number } | null
}) {
  const { t } = useTranslation()

  const activeConfig = selectedConfig ?? configs[0]
  const groupPathCards = groups.map((group) => {
    const directNode = group.nodes[0]
    const subscriptionBinding = group.subscriptions[0]
    const subscriptionNodes = subscriptionBinding?.matchedNodes ?? []
    const destination = directNode
      ? {
          title: getNodeDisplayName(directNode),
          subtitle: t('workspaceSummary.manualNode'),
        }
      : subscriptionBinding
        ? {
            title: subscriptionBinding.subscription.tag || subscriptionBinding.subscription.link || '—',
            subtitle: `${t('workspaceSummary.fromSubscription')} · ${t('groupPicker.subscriptionPreviewMatchedCount', {
              count: subscriptionBinding.matchedCount,
            })}`,
            tooltipNodes: subscriptionNodes.map(getNodeDisplayName),
          }
        : undefined

    return {
      group,
      destination,
      latencyLabel: directNode
        ? (formatLatencyLabel(nodeLatencies?.[directNode.id]) ?? t('latency.unavailable'))
        : subscriptionBinding
          ? (formatBestLatencyLabel(subscriptionNodes, nodeLatencies) ?? t('latency.unavailable'))
          : '—',
    }
  })
  const topNodes = getTopNodes(sortedNodes, subscriptions, nodeLatencies)
  const topSubscriptions = subscriptions.slice(0, 2)
  const manualNodeCount = sortedNodes.filter((node) => !node.subscriptionID).length
  const nodeLatencyActionLabel = testingLatencyProgress
    ? `${t('latency.testAllNodes')} · ${testingLatencyProgress.completed}/${testingLatencyProgress.total}`
    : t('latency.testAllNodes')

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
    <section className="grid gap-5 lg:grid-cols-3">
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
          rows={[{ label: t('workspaceSummary.fallbackDns'), value: activeConfig?.global.fallbackResolver || '—' }]}
        />
      </SummaryShell>

      <SummaryShell
        title={t('group')}
        subtitle={t('workspaceSummary.groupSubtitle')}
        icon={<Map className="h-4.5 w-4.5" />}
        actionLabel={t('actions.viewDetails')}
        onAction={onOpenGroup}
      >
        <div className="max-h-[29rem] space-y-2.5 overflow-y-auto overscroll-contain pr-1">
          {groupPathCards.map(({ group, destination, latencyLabel }) => (
            <CurrentGroupPathCard
              key={group.id}
              groupName={group.name || '—'}
              currentLabel={t('workspaceSummary.currentGroup')}
              policy={group.policy}
              policyLabel={t('policy')}
              destination={destination}
              latencyTitle={t('latency.label')}
              latencyLabel={latencyLabel}
            />
          ))}
        </div>
      </SummaryShell>

      <SummaryShell
        title={t('workspaceSummary.nodeSubscriptionTitle')}
        subtitle={t('workspaceSummary.nodeSubscriptionSubtitle')}
        icon={<CloudCog className="h-4.5 w-4.5" />}
        actionLabel={nodeLatencyActionLabel}
        actionDisabled={testingLatencies}
        onAction={onTestAllNodeLatencies}
      >
        <div className="space-y-2">
          {topNodes.map(({ node, latency, source }, index) => {
            const hasLatency = Number.isFinite(latency)
            const sourceLabel =
              source.type === 'subscription'
                ? `${t('workspaceSummary.fromSubscription')} · ${source.name}`
                : t('workspaceSummary.manualNode')
            const nodeMeta = [sourceLabel, node.protocol, node.address].filter(Boolean).join(' · ')

            return (
              <NodeRow
                key={node.id}
                rank={index + 1}
                title={node.name || node.tag || node.address}
                subtitle={nodeMeta}
                latencyLabel={hasLatency ? `${latency} ms` : t('latency.unavailable')}
                warn={hasLatency && latency >= 80}
                muted={!hasLatency}
              />
            )
          })}
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
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-border bg-card/80 px-3 py-2.5">
            <strong className="truncate text-sm font-semibold text-foreground">
              {t('workspaceSummary.manualNodes')}
            </strong>
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
