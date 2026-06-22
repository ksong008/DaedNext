import type {
  ConfigResource,
  GeodataKind,
  GeodataResource,
  GeodataView,
  GroupSummaryResource,
  InterfaceResource,
  NodeLatencyProbeResult,
  NodeResource,
  SectionSummaryResource,
  SubscriptionSummaryResource,
} from '~/apis/types'
import { CloudCog, Map as MapIcon, Pencil, RefreshCw, Settings } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useUpdateGeodataMutation } from '~/apis'

import { NodeProtocolBadge } from '~/components/NodeProtocolBadge'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { formatNodeLatencyCardLabel, getNodeLatencyCardTone } from '~/utils/node_display'

const summaryShellStyle = {
  background: 'color-mix(in oklab, var(--card) 97%, var(--primary) 3%)',
  borderColor: 'color-mix(in oklab, var(--border) 90%, var(--primary) 10%)',
  boxShadow: '0 7px 18px color-mix(in oklab, var(--foreground) 4%, transparent)',
}

const summaryActionButtonClassName =
  'max-w-[7.5rem] shrink-0 rounded-full border-primary/14 bg-primary/7 px-2.5 text-primary shadow-none hover:border-primary/24 hover:bg-primary/12 hover:text-primary sm:max-w-[10rem] dark:border-primary/16 dark:bg-primary/8 dark:hover:bg-primary/12'

const summaryInnerCardClassName =
  'rounded-[14px] border border-border/55 bg-accent/22 shadow-none transition-colors hover:border-border/70'

const summaryResourceCardClassName =
  'rounded-[16px] border border-border/55 bg-accent/20 shadow-none transition-colors hover:border-border/70'

const summaryStatusPillClassName =
  'rounded-full border border-primary/12 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/8'

const summaryDataPillClassName =
  'rounded-full bg-muted/64 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/64'

const summaryLatencyPillClassName =
  'rounded-full border border-primary/10 bg-primary/6 px-2.5 py-1 text-xs font-medium text-primary/78 hover:bg-primary/6'

const summaryTypePillClassName =
  'rounded-full bg-primary/7 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/7 sm:px-2.5 sm:text-xs'

interface SummaryNodeIdentity {
  title: string
  protocol?: string
  transport?: string
}

interface SummaryDestination extends SummaryNodeIdentity {
  subtitle: string
  tooltipNodes?: SummaryNodeIdentity[]
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
    <section
      className="flex min-h-[430px] max-h-[620px] flex-col overflow-hidden rounded-[18px] border sm:min-h-[460px] lg:h-[500px] lg:min-h-0 lg:max-h-none"
      style={summaryShellStyle}
    >
      <div className="flex min-h-[72px] items-start justify-between gap-2.5 border-b border-border/55 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/14 bg-primary/7 text-primary sm:h-9 sm:w-9">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[0.98rem] font-semibold text-foreground sm:text-base">{title}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="xs"
          className={summaryActionButtonClassName}
          disabled={actionDisabled}
          onClick={onAction}
        >
          <span className="truncate">{actionLabel}</span>
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3 sm:gap-3 sm:p-4">{children}</div>
    </section>
  )
}

function SummaryNodeProtocolStack({
  protocol,
  transport,
  compact,
}: {
  protocol?: string
  transport?: string
  compact?: boolean
}) {
  return <NodeProtocolBadge protocol={protocol} transport={transport} compact={compact} className="max-w-[5rem]" />
}

function SummaryNodeIdentityView({
  node,
  compact,
  badgeCompact,
}: {
  node: SummaryNodeIdentity
  compact?: boolean
  badgeCompact?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <SummaryNodeProtocolStack
          protocol={node.protocol}
          transport={node.transport}
          compact={badgeCompact ?? compact}
        />
        <strong
          className={cn(
            'block min-w-0 truncate font-bold leading-none text-foreground',
            compact ? 'text-xs' : 'text-[1rem] sm:text-[1.08rem]',
          )}
        >
          {node.title || '—'}
        </strong>
      </div>
    </div>
  )
}

function SummaryConfigCard({
  label,
  value,
  tag,
  detail,
}: {
  label: string
  value: string
  tag?: string
  detail?: string
}) {
  return (
    <div
      className={cn(
        summaryInnerCardClassName,
        'flex min-h-[74px] min-w-0 flex-col justify-between px-3 py-2.5 sm:min-h-[78px] sm:px-3.5 sm:py-3',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 truncate">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {tag ? <Badge className={summaryStatusPillClassName}>{tag}</Badge> : null}
      </div>
      <div className="min-w-0">
        <strong className="block truncate text-base font-bold leading-none text-foreground sm:text-lg">{value}</strong>
        {detail ? <span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </div>
    </div>
  )
}

function SummaryGeodataCard({
  kind,
  title,
  versionLabel,
  categoryLabel,
  itemLabel,
  data,
  updateLabel,
  updating,
  onUpdate,
}: {
  kind: GeodataKind
  title: string
  versionLabel: string
  categoryLabel: string
  itemLabel: string
  data?: GeodataResource
  updateLabel: string
  updating?: boolean
  onUpdate?: (kind: GeodataKind) => void | Promise<void>
}) {
  const formatter = useMemo(() => new Intl.NumberFormat(), [])
  const itemCount = kind === 'geosite' ? data?.ruleCount : data?.cidrCount
  const valueOrDash = (value?: number) => (typeof value === 'number' ? formatter.format(value) : '—')

  return (
    <div
      className={cn(
        summaryInnerCardClassName,
        'relative flex min-h-[108px] min-w-0 flex-col gap-2 px-3 py-2.5 pr-10 sm:min-h-[112px] sm:px-3.5 sm:py-3 sm:pr-11',
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 h-7 w-7 rounded-full border border-primary/10 bg-primary/6 text-primary shadow-none hover:bg-primary/10 hover:text-primary"
            aria-label={updateLabel}
            disabled={updating}
            onClick={() => void onUpdate?.(kind)}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', updating && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{updateLabel}</TooltipContent>
      </Tooltip>
      <div className="min-w-0">
        <span className="block truncate text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className="text-muted-foreground">{versionLabel}</span>
          <strong className="min-w-0 truncate text-right text-sm font-semibold leading-none text-foreground">
            {data?.version || '—'}
          </strong>
        </div>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className="text-muted-foreground">{categoryLabel}</span>
          <strong className="min-w-0 truncate text-right text-sm font-semibold leading-none text-foreground tabular-nums">
            {valueOrDash(data?.categoryCount)}
          </strong>
        </div>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className="text-muted-foreground">{itemLabel}</span>
          <strong className="min-w-0 truncate text-right text-sm font-semibold leading-none text-foreground tabular-nums">
            {valueOrDash(itemCount)}
          </strong>
        </div>
      </div>
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
  latencyTone = 'unavailable',
  editGroupLabel,
  onEditGroup,
}: {
  groupName: string
  currentLabel: string
  policy?: string
  policyLabel: string
  destination?: SummaryDestination
  latencyTitle: string
  latencyLabel?: string
  latencyTone?: 'success' | 'failure' | 'unavailable'
  editGroupLabel?: string
  onEditGroup?: () => void
}) {
  const groupNameMaxWidth = destination?.title && destination.title.length > 16 ? '7.25rem' : '9rem'
  const destinationTitleContent = (
    <div className={cn('min-w-0', destination?.tooltipNodes?.length ? 'cursor-default' : '')}>
      <SummaryNodeIdentityView node={destination || { title: '—' }} badgeCompact />
    </div>
  )

  return (
    <article
      className={cn(
        'relative rounded-[16px] border border-border/55 bg-accent/18 py-2.5 pl-3 shadow-none transition-colors hover:border-border/70 sm:py-3 sm:pl-3.5',
        onEditGroup ? 'pr-10 sm:pr-11' : 'pr-3 sm:pr-3.5',
      )}
    >
      {onEditGroup && editGroupLabel ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full border border-primary/10 bg-primary/6 text-primary shadow-none hover:bg-primary/10 hover:text-primary"
          aria-label={editGroupLabel}
          onClick={onEditGroup}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
        <span
          className="min-w-0 truncate text-[11px] font-medium text-muted-foreground/75 sm:text-xs"
          style={{ maxWidth: groupNameMaxWidth }}
        >
          {currentLabel}
        </span>
        <span aria-hidden="true" />
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground/75 sm:text-xs">
          {destination?.subtitle || '—'}
        </span>

        <strong
          className="min-w-0 truncate text-[1rem] font-bold leading-none text-foreground sm:text-[1.08rem]"
          style={{ maxWidth: groupNameMaxWidth }}
        >
          {groupName}
        </strong>

        <div className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-primary/10 bg-primary/6 text-[10px] font-medium leading-none text-primary/85">
          →
        </div>

        <div className="min-w-0">
          {destination?.tooltipNodes?.length ? (
            <Tooltip>
              <TooltipTrigger asChild>{destinationTitleContent}</TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-h-72 w-80 overflow-y-auto p-2 text-xs">
                <div className="mb-2 border-b border-border/70 px-1 pb-1.5 font-semibold text-muted-foreground">
                  {destination.subtitle}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {destination.tooltipNodes.map((node, index) => (
                    <div
                      key={`${node.title}-${index}`}
                      className="min-w-0 max-w-full rounded-md border border-border/60 bg-background/70 px-2 py-1.5 text-foreground sm:max-w-[15rem]"
                    >
                      <SummaryNodeIdentityView node={node} compact />
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            destinationTitleContent
          )}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border/55 pt-2.5 sm:mt-3">
        <Badge className={cn(summaryTypePillClassName, 'min-w-0 max-w-full justify-self-start')}>
          <span className="mr-1 shrink-0 text-primary/70">{policyLabel}</span>
          <span className="truncate">{policy || '—'}</span>
        </Badge>
        <Badge
          className={cn(summaryLatencyPillClassName, 'shrink-0 justify-self-end px-2 text-[11px] sm:px-2.5 sm:text-xs')}
        >
          <span className="mr-1 opacity-70">{latencyTitle}</span>
          <span className={cn('font-semibold', latencyTone === 'failure' ? 'text-destructive' : 'text-primary')}>
            {latencyLabel || '—'}
          </span>
        </Badge>
      </div>
    </article>
  )
}

function NodeRow({
  rank,
  title,
  subtitle,
  protocol,
  transport,
  latencyLabel,
  warn,
  muted,
}: {
  rank: number
  title: string
  subtitle: string
  protocol?: string
  transport?: string
  latencyLabel: string
  warn?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        summaryResourceCardClassName,
        'grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2.5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:gap-3 sm:px-3',
      )}
    >
      <span className="grid h-7 w-7 place-items-center rounded-[11px] bg-primary/8 text-xs font-extrabold text-primary sm:h-8 sm:w-8 sm:rounded-[12px]">
        {rank}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <NodeProtocolBadge protocol={protocol} transport={transport} compact className="max-w-[5rem]" />
          <strong className="block min-w-0 truncate text-sm font-semibold text-foreground">{title}</strong>
        </div>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <Badge
        className={cn(
          'max-w-[6.5rem] truncate sm:max-w-none',
          muted
            ? summaryDataPillClassName
            : warn
              ? 'rounded-full bg-destructive/8 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/8'
              : summaryStatusPillClassName,
        )}
      >
        {latencyLabel}
      </Badge>
    </div>
  )
}

function StatusRow({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return (
    <div className="grid min-h-[50px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-[14px] border border-border/35 bg-accent/10 px-2.5 py-2 sm:gap-x-3 sm:px-3">
      <strong className="truncate text-sm font-semibold text-foreground">{title}</strong>
      <Badge className={summaryStatusPillClassName}>{badge}</Badge>
      <span className="col-span-2 truncate text-sm text-muted-foreground">{subtitle}</span>
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
    <div className="grid grid-cols-2 gap-1 rounded-[16px] border border-border/55 bg-accent/18 p-1">
      <button
        type="button"
        className="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-background/70 sm:px-3.5"
        onClick={onLeft}
      >
        <span>{leftLabel}</span>
        <span className="text-muted-foreground">›</span>
      </button>
      <button
        type="button"
        className="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-background/70 sm:px-3.5"
        onClick={onRight}
      >
        <span>{rightLabel}</span>
        <span className="text-muted-foreground">›</span>
      </button>
    </div>
  )
}

function formatLatencyLabel(result?: NodeLatencyProbeResult) {
  if (!result) return undefined
  return formatNodeLatencyCardLabel(result, '') || undefined
}

function formatLatencyTone(result?: NodeLatencyProbeResult) {
  return getNodeLatencyCardTone(result)
}

function formatBestLatencyLabel(nodes: NodeResource[], nodeLatencies?: Record<string, NodeLatencyProbeResult>) {
  const results = nodes.map((node) => nodeLatencies?.[node.id]).filter(Boolean) as NodeLatencyProbeResult[]
  const latencies = results
    .map((result) => result.latencyMs)
    .filter((latency): latency is number => typeof latency === 'number')

  if (latencies.length === 0) {
    return results.some((result) => result.message && result.message !== 'no latency result') ? 'fail' : undefined
  }

  return `${Math.min(...latencies)} ms`
}

function formatBestLatencyTone(nodes: NodeResource[], nodeLatencies?: Record<string, NodeLatencyProbeResult>) {
  const results = nodes.map((node) => nodeLatencies?.[node.id]).filter(Boolean) as NodeLatencyProbeResult[]
  if (results.some((result) => typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs))) {
    return 'success'
  }
  if (results.length > 0) {
    return 'failure'
  }
  return 'unavailable'
}

function getNodeDisplayName(node: NodeResource) {
  return node.tag || node.name || node.address || '—'
}

function getNodeIdentity(node: NodeResource): SummaryNodeIdentity {
  return {
    title: getNodeDisplayName(node),
    protocol: node.protocol || undefined,
    transport: node.transport || undefined,
  }
}

function formatInterfaceSummary(items: Array<{ name: string; address?: string }>) {
  if (items.length === 0) {
    return { value: '—' }
  }

  return {
    value: items.map((item) => item.name).join(', '),
    detail: items
      .map((item) => item.address)
      .filter(Boolean)
      .join(', '),
  }
}

interface RankedNode {
  node: NodeResource
  latency: number
  source: { type: 'manual' } | { type: 'subscription'; name: string }
}

function getTopNodes(
  nodes: NodeResource[],
  subscriptionBackedNodes: NodeResource[],
  subscriptionNameById: Map<string, string>,
  nodeLatencies?: Record<string, NodeLatencyProbeResult>,
): RankedNode[] {
  const rankedNodes: RankedNode[] = []
  const seenNodeIds = new Set<string>()

  for (const node of nodes) {
    if (node.subscriptionID) continue

    rankedNodes.push({
      node,
      latency: nodeLatencies?.[node.id]?.latencyMs ?? Number.POSITIVE_INFINITY,
      source: { type: 'manual' },
    })
    seenNodeIds.add(node.id)
  }

  for (const node of subscriptionBackedNodes) {
    if (seenNodeIds.has(node.id)) continue

    rankedNodes.push({
      node,
      latency: nodeLatencies?.[node.id]?.latencyMs ?? Number.POSITIVE_INFINITY,
      source: {
        type: 'subscription',
        name: (node.subscriptionID && subscriptionNameById.get(node.subscriptionID)) || '—',
      },
    })
    seenNodeIds.add(node.id)
  }

  return rankedNodes.sort((left, right) => left.latency - right.latency).slice(0, 3)
}

export const WorkspaceSummaryCards = memo(
  ({
    selectedConfig,
    geodata,
    configs,
    groups,
    sortedNodes,
    subscriptionBackedNodes,
    subscriptions,
    manualNodeCount,
    interfaces,
    nodeLatencies,
    onOpenConfig,
    onOpenGroup,
    onEditGroupResources,
    onOpenNodes,
    onOpenSubscriptions,
    onTestAllNodeLatencies,
    testingLatencies,
    testingLatencyProgress,
  }: {
    selectedConfig?: ConfigResource
    geodata?: GeodataView
    configs: SectionSummaryResource[]
    groups: GroupSummaryResource[]
    sortedNodes: NodeResource[]
    subscriptionBackedNodes: NodeResource[]
    subscriptions: SubscriptionSummaryResource[]
    manualNodeCount?: number
    interfaces: InterfaceResource[]
    nodeLatencies?: Record<string, NodeLatencyProbeResult>
    onOpenConfig?: () => void
    onOpenGroup?: () => void
    onEditGroupResources?: (groupId: string) => void
    onOpenNodes?: () => void
    onOpenSubscriptions?: () => void
    onTestAllNodeLatencies?: () => void | Promise<void>
    testingLatencies?: boolean
    testingLatencyProgress?: { completed: number; total: number } | null
  }) => {
    const { t } = useTranslation()
    const updateGeodataMutation = useUpdateGeodataMutation()

    const selectedConfigSummary = useMemo(() => configs.find((config) => config.selected) ?? configs[0], [configs])
    const activeConfigName = selectedConfig?.name || selectedConfigSummary?.name || 'default'
    const subscriptionNameById = useMemo(
      () => new Map(subscriptions.map((subscription) => [subscription.id, subscription.tag || subscription.link])),
      [subscriptions],
    )
    const groupPathCards = useMemo(
      () =>
        groups.map((group) => {
          const directNode = group.firstNode ?? undefined
          const directNodeSubscriptionName = directNode?.subscriptionID
            ? subscriptionNameById.get(directNode.subscriptionID)
            : undefined
          const subscriptionBinding = group.firstSubscription ?? undefined
          const subscriptionNodes = subscriptionBinding?.sampleMatchedNodes ?? []
          const destination = directNode
            ? {
                ...getNodeIdentity(directNode),
                subtitle: directNode.subscriptionID
                  ? [t('workspaceSummary.fromSubscription'), directNodeSubscriptionName].filter(Boolean).join(' · ')
                  : t('workspaceSummary.manualNode'),
              }
            : subscriptionBinding
              ? {
                  title: subscriptionBinding.subscription.tag || subscriptionBinding.subscription.link || '—',
                  subtitle: `${t('workspaceSummary.fromSubscription')} · ${t(
                    'groupPicker.subscriptionPreviewMatchedCount',
                    {
                      count: subscriptionBinding.matchedCount,
                    },
                  )}`,
                  tooltipNodes: subscriptionNodes.map(getNodeIdentity),
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
            latencyTone: directNode
              ? formatLatencyTone(nodeLatencies?.[directNode.id])
              : subscriptionBinding
                ? formatBestLatencyTone(subscriptionNodes, nodeLatencies)
                : 'unavailable',
          }
        }),
      [groups, nodeLatencies, subscriptionNameById, t],
    )
    const topNodes = useMemo(
      () => getTopNodes(sortedNodes, subscriptionBackedNodes, subscriptionNameById, nodeLatencies),
      [nodeLatencies, sortedNodes, subscriptionBackedNodes, subscriptionNameById],
    )
    const topSubscriptions = useMemo(() => subscriptions.slice(0, 2), [subscriptions])
    const displayedManualNodeCount = useMemo(
      () =>
        manualNodeCount ??
        (sortedNodes.length > 0 ? sortedNodes.filter((node) => !node.subscriptionID).length : undefined),
      [manualNodeCount, sortedNodes],
    )
    const nodeLatencyActionLabel = testingLatencyProgress
      ? `${t('latency.testAllNodes')} · ${testingLatencyProgress.completed}/${testingLatencyProgress.total}`
      : t('latency.testAllNodes')

    const wanInterfaceSummary = useMemo(() => {
      const wanInterfaceItems = (selectedConfig?.global.wanInterface ?? []).flatMap((value) => {
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
      return formatInterfaceSummary(wanInterfaceItems)
    }, [interfaces, selectedConfig?.global.wanInterface])
    const lanInterfaceSummary = useMemo(() => {
      const lanInterfaceItems = (selectedConfig?.global.lanInterface ?? []).map((value) => {
        const iface = interfaces.find((item) => item.name === value)
        return iface ? { name: iface.name, address: iface.addresses[0] } : { name: value }
      })
      return formatInterfaceSummary(lanInterfaceItems)
    }, [interfaces, selectedConfig?.global.lanInterface])
    const updateGeodata = async (kind: GeodataKind) => {
      try {
        const result = await updateGeodataMutation.mutateAsync(kind)
        toast.success(
          result.runtimeReloaded
            ? t('workspaceSummary.geodataUpdateApplied')
            : t('workspaceSummary.geodataUpdateSuccess'),
        )
      } catch {
        toast.error(t('error'))
      }
    }

    return (
      <section className="grid items-stretch gap-4 lg:grid-cols-3 lg:gap-5">
        <SummaryShell
          title={t('config')}
          subtitle={t('workspaceSummary.configSubtitle')}
          icon={<Settings className="h-4.5 w-4.5" />}
          actionLabel={t('actions.settings')}
          onAction={onOpenConfig}
        >
          <div className="grid grid-cols-2 content-start items-start gap-2">
            <SummaryConfigCard
              label={t('workspaceSummary.currentConfig')}
              value={activeConfigName}
              tag={t('workspaceSummary.applied')}
            />
            <SummaryConfigCard label={t('tproxyPort')} value={String(selectedConfig?.global.tproxyPort ?? '—')} />
            <SummaryConfigCard
              label={t('wanInterface')}
              value={wanInterfaceSummary.value}
              detail={wanInterfaceSummary.detail}
            />
            <SummaryConfigCard
              label={t('lanInterface')}
              value={lanInterfaceSummary.value}
              detail={lanInterfaceSummary.detail}
            />
            <SummaryConfigCard label={t('dialMode')} value={selectedConfig?.global.dialMode || '—'} />
            <SummaryConfigCard
              label={t('workspaceSummary.fallbackDns')}
              value={selectedConfig?.global.fallbackResolver || '—'}
            />
            <SummaryGeodataCard
              kind="geosite"
              title={t('workspaceSummary.geosite')}
              versionLabel={t('workspaceSummary.version')}
              categoryLabel={t('workspaceSummary.categoryCount')}
              itemLabel={t('workspaceSummary.ruleCount')}
              data={geodata?.geosite}
              updateLabel={t('workspaceSummary.updateGeosite')}
              updating={updateGeodataMutation.isPending}
              onUpdate={updateGeodata}
            />
            <SummaryGeodataCard
              kind="geoip"
              title={t('workspaceSummary.geoip')}
              versionLabel={t('workspaceSummary.version')}
              categoryLabel={t('workspaceSummary.categoryCount')}
              itemLabel={t('workspaceSummary.cidrCount')}
              data={geodata?.geoip}
              updateLabel={t('workspaceSummary.updateGeoip')}
              updating={updateGeodataMutation.isPending}
              onUpdate={updateGeodata}
            />
          </div>
        </SummaryShell>

        <SummaryShell
          title={t('group')}
          subtitle={t('workspaceSummary.groupSubtitle')}
          icon={<MapIcon className="h-4.5 w-4.5" />}
          actionLabel={t('actions.viewDetails')}
          onAction={onOpenGroup}
        >
          <div className="min-h-0 max-h-[340px] flex-1 space-y-2.5 overflow-y-auto overscroll-contain py-0.5 pr-1 lg:max-h-none">
            {groupPathCards.map(({ group, destination, latencyLabel, latencyTone }) => (
              <CurrentGroupPathCard
                key={group.id}
                groupName={group.name || '—'}
                currentLabel={t('workspaceSummary.currentGroup')}
                policy={group.policy}
                policyLabel={t('policy')}
                destination={destination}
                latencyTitle={t('latency.label')}
                latencyLabel={latencyLabel}
                latencyTone={latencyTone}
                editGroupLabel={t('groupPicker.editGroupResources')}
                onEditGroup={onEditGroupResources ? () => onEditGroupResources(group.id) : undefined}
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
          <div className="min-h-0 max-h-[326px] space-y-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[276px]">
            <div className="space-y-2">
              {topNodes.map(({ node, latency, source }, index) => {
                const hasLatency = Number.isFinite(latency)
                const sourceLabel =
                  source.type === 'subscription'
                    ? `${t('workspaceSummary.fromSubscription')} · ${source.name}`
                    : t('workspaceSummary.customNode')
                const nodeMeta = [sourceLabel, node.address].filter(Boolean).join(' · ')

                return (
                  <NodeRow
                    key={node.id}
                    rank={index + 1}
                    title={node.name || node.tag || node.address}
                    subtitle={nodeMeta}
                    protocol={node.protocol || undefined}
                    transport={node.transport || undefined}
                    latencyLabel={hasLatency ? `${latency} ms` : t('latency.unavailable')}
                    warn={hasLatency && latency >= 80}
                    muted={!hasLatency}
                  />
                )
              })}
            </div>
            <div className="space-y-1.5">
              {topSubscriptions.map((subscription) => (
                <StatusRow
                  key={subscription.id}
                  title={subscription.tag || subscription.link}
                  subtitle={`${t('workspaceSummary.subscriptionUpdated')} · ${subscription.nodeCount} ${t('node')}`}
                  badge={t('workspaceSummary.healthy')}
                />
              ))}
              <div className="grid min-h-[48px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-border/35 bg-accent/10 px-3 py-2">
                <strong className="truncate text-sm font-semibold text-foreground">
                  {t('workspaceSummary.customNodes')}
                </strong>
                <span className="text-sm font-bold text-muted-foreground">{displayedManualNodeCount ?? '—'}</span>
              </div>
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
  },
)
