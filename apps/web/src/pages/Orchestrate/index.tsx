import type { SummaryGroupEditMode } from './GroupResourceEditor'
import type { NodeLatencyProbeResult } from '~/apis'
import type {
  GroupListView,
  GroupSummaryResource,
  InterfaceResource,
  NodeListView,
  SectionSummaryResource,
  SubscriptionListView,
  SubscriptionSummaryResource,
} from '~/apis/types'
import { useStore } from '@nanostores/react'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  useConfigQuery,
  useConfigSummariesQuery,
  useGeneralStateQuery,
  useGeodataQuery,
  useGroupsQuery,
  useGroupsSummaryQuery,
  useInterfacesQuery,
  useNodeLatenciesQuery,
  useNodesQuery,
  useSubscriptionBackedNodesQuery,
  useSubscriptionsQuery,
  useSubscriptionsSummaryQuery,
} from '~/apis'
import { webQueryKeys } from '~/apis/query_cache'
import { Dialog, DialogTitle } from '~/components/ui/dialog'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'
import { DraggableResourceType, ORCHESTRATE_SECTION_IDS, QUERY_KEY_NODE_LATENCY } from '~/constants'
import { useMediaQuery } from '~/hooks'
import {
  usePersistentGroupSortOrders,
  usePersistentSortOrder,
  useServerGroupSortState,
} from '~/hooks/usePersistentSortOrder'
import { cn } from '~/lib/utils'
import { appStateAtom } from '~/store'
import { deriveTime } from '~/utils'
import { reconcileSortOrder } from '~/utils/sort_order'
import { GroupResourceEditor } from './GroupResourceEditor'
import { TrafficOverviewIsland } from './TrafficOverviewIsland'
import { useManualLatencyJob } from './useManualLatencyJob'
import { useOrchestrateDrag } from './useOrchestrateDrag'
import { WorkspaceSummaryCards } from './WorkspaceSummaryCards'

const ConfigPanel = lazy(() => import('./Config').then((module) => ({ default: module.Config })))
const DNSPanel = lazy(() => import('./DNS').then((module) => ({ default: module.DNS })))
const GroupResourcePanel = lazy(() => import('./Group').then((module) => ({ default: module.GroupResource })))
const LogResourcePanel = lazy(() => import('./Logs').then((module) => ({ default: module.LogResource })))
const NodeResourcePanel = lazy(() => import('./Node').then((module) => ({ default: module.NodeResource })))
const RoutingPanel = lazy(() => import('./Routing').then((module) => ({ default: module.Routing })))
const SubscriptionResourcePanel = lazy(() =>
  import('./Subscription').then((module) => ({ default: module.SubscriptionResource })),
)
const LazyDragDropContext = lazy(() =>
  import('./DragDropIsland').then((module) => ({ default: module.OrchestrateDragDropContext })),
)

const EMPTY_CONFIG_SUMMARIES: SectionSummaryResource[] = []
const EMPTY_GROUP_SUMMARIES: GroupSummaryResource[] = []
const EMPTY_SUBSCRIPTION_SUMMARIES: SubscriptionSummaryResource[] = []
const EMPTY_INTERFACES: InterfaceResource[] = []

function PanelLoadingFallback() {
  return <div className="min-h-28 rounded-xl border border-border/70 bg-muted/20" aria-busy="true" />
}

export function OrchestratePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const groupSortStateReady = useServerGroupSortState()
  const activeWorkspacePanel = useMemo(() => {
    const panel = searchParams.get('panel')
    if (!panel || panel === 'overview') return null
    if (
      panel === 'config' ||
      panel === 'log' ||
      panel === 'dns' ||
      panel === 'routing' ||
      panel === 'group' ||
      panel === 'node' ||
      panel === 'subscription'
    ) {
      return panel
    }
    return null
  }, [searchParams])
  const [summaryEditingGroupId, setSummaryEditingGroupId] = useState<string | null>(null)
  const [summaryGroupEditMode, setSummaryGroupEditMode] = useState<SummaryGroupEditMode | null>(null)
  const fullGroupQueryEnabled = activeWorkspacePanel === 'group' || summaryGroupEditMode !== null
  const fullSubscriptionQueryEnabled =
    activeWorkspacePanel === 'subscription' ||
    activeWorkspacePanel === 'group' ||
    summaryGroupEditMode === 'nodes' ||
    summaryGroupEditMode === 'subscriptions'
  const { data: configSummariesQuery } = useConfigSummariesQuery()
  const selectedConfigSummary = useMemo(
    () => configSummariesQuery?.configs.find((config) => config.selected) ?? configSummariesQuery?.configs[0],
    [configSummariesQuery?.configs],
  )
  const { data: selectedConfig } = useConfigQuery(selectedConfigSummary?.id, !!selectedConfigSummary?.id)
  const { data: generalStateQuery } = useGeneralStateQuery()
  const { data: interfaces } = useInterfacesQuery()
  const { data: geodata } = useGeodataQuery()
  const { data: nodesQuery } = useNodesQuery()
  const { data: subscriptionBackedNodesQuery } = useSubscriptionBackedNodesQuery()
  const { data: groupSummariesQuery } = useGroupsSummaryQuery()
  const { data: groupsQuery } = useGroupsQuery(fullGroupQueryEnabled)
  const { data: subscriptionSummariesQuery } = useSubscriptionsSummaryQuery()
  const { data: subscriptionsQuery } = useSubscriptionsQuery(fullSubscriptionQueryEnabled)

  const [manualLatencyProbeOverrides, setManualLatencyProbeOverrides] = useState<
    Record<string, NodeLatencyProbeResult>
  >({})

  // Use persistent store for sort order
  const appState = useStore(appStateAtom)
  const storedNodeSortOrder = appState.nodeSortableKeys as string[]
  const storedSubscriptionSortOrder = appState.subscriptionSortableKeys as string[]
  const storedGroupSortOrder = appState.groupSortableKeys as string[]

  // Get nodes from query (memoized to avoid dependency issues)
  const nodes = useMemo(() => nodesQuery?.nodes.items ?? [], [nodesQuery?.nodes.items])
  const subscriptionBackedNodes = useMemo(
    () => subscriptionBackedNodesQuery?.nodes.items ?? [],
    [subscriptionBackedNodesQuery?.nodes.items],
  )
  const groups = useMemo(() => groupsQuery?.groups ?? [], [groupsQuery?.groups])
  const groupSummaries = useMemo(
    () => groupSummariesQuery?.groups ?? EMPTY_GROUP_SUMMARIES,
    [groupSummariesQuery?.groups],
  )
  const subscriptions = useMemo(() => subscriptionsQuery?.subscriptions ?? [], [subscriptionsQuery?.subscriptions])
  const subscriptionSummaries = useMemo(
    () => subscriptionSummariesQuery?.subscriptions ?? EMPTY_SUBSCRIPTION_SUMMARIES,
    [subscriptionSummariesQuery?.subscriptions],
  )
  const currentNodeIds = useMemo(() => nodes.map((node) => node.id), [nodes])
  const currentSubscriptionIds = useMemo(
    () => subscriptionSummaries.map((subscription) => subscription.id),
    [subscriptionSummaries],
  )
  const currentGroupIds = useMemo(() => groupSummaries.map((group) => group.id), [groupSummaries])
  const nodeSortOrder = usePersistentSortOrder(
    'nodeSortableKeys',
    storedNodeSortOrder,
    currentNodeIds,
    nodesQuery !== undefined,
  )
  const subscriptionSortOrder = usePersistentSortOrder(
    'subscriptionSortableKeys',
    storedSubscriptionSortOrder,
    currentSubscriptionIds,
    subscriptionSummariesQuery !== undefined,
  )
  const groupSortOrder = usePersistentSortOrder(
    'groupSortableKeys',
    storedGroupSortOrder,
    currentGroupIds,
    groupSortStateReady && groupSummariesQuery !== undefined,
  )
  const groupSortMemberships = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        nodeIds: group.nodes.map((node) => node.id),
        subscriptionIds: group.subscriptions.map((binding) => binding.subscription.id),
      })),
    [groups],
  )
  usePersistentGroupSortOrders(groupSortMemberships, groupSortStateReady && groupsQuery !== undefined)
  const [nodeLatenciesEnabled, setNodeLatenciesEnabled] = useState(false)
  const startupDataReady = !!configSummariesQuery && !!groupSummariesQuery && !!subscriptionSummariesQuery
  const nodeLatencyRefetchIntervalMs = useMemo(() => {
    const configuredInterval = selectedConfig?.global.checkInterval
    if (!configuredInterval) return 30_000

    const ms = deriveTime(configuredInterval, 'ms')
    return Math.max(1_000, Number.isFinite(ms) ? ms : 30_000)
  }, [selectedConfig?.global.checkInterval])
  useEffect(() => {
    if (!startupDataReady || nodeLatenciesEnabled) return

    let cancelled = false
    const activate = () => {
      if (cancelled) return
      startTransition(() => {
        setNodeLatenciesEnabled(true)
      })
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleHandle = window.requestIdleCallback(activate, { timeout: 1500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleHandle)
      }
    }

    const timeoutId = globalThis.setTimeout(activate, 0)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [nodeLatenciesEnabled, startupDataReady])

  const nodeLatenciesQuery = useNodeLatenciesQuery(nodeLatencyRefetchIntervalMs, nodeLatenciesEnabled)
  const nodeLatencies = useMemo<Record<string, NodeLatencyProbeResult>>(() => {
    const baseResults = Object.fromEntries((nodeLatenciesQuery.data ?? []).map((result) => [result.id, result]))
    return {
      ...baseResults,
      ...manualLatencyProbeOverrides,
    }
  }, [manualLatencyProbeOverrides, nodeLatenciesQuery.data])
  const lastLatencyProbeAt = useMemo(() => {
    let latestTestedAt: string | null = null

    for (const item of Object.values(nodeLatencies)) {
      if (item.testedAt && (!latestTestedAt || item.testedAt > latestTestedAt)) {
        latestTestedAt = item.testedAt
      }
    }

    return latestTestedAt
  }, [nodeLatencies])
  const manualNodeCount = nodesQuery?.nodes.totalCount ?? nodes.length
  const loadedNodeCount = useMemo(() => {
    const nodeIds = new Set<string>()

    for (const node of nodes) {
      nodeIds.add(node.id)
    }

    for (const node of subscriptionBackedNodes) {
      nodeIds.add(node.id)
    }

    for (const subscription of subscriptions) {
      for (const node of subscription.nodes.items) {
        nodeIds.add(node.id)
      }
    }

    return nodeIds.size
  }, [nodes, subscriptionBackedNodes, subscriptions])
  const totalNodeCount = generalStateQuery?.general.counts.nodes ?? loadedNodeCount
  const minLatencyMs = useMemo(() => {
    let minLatencyMs: number | undefined

    for (const result of Object.values(nodeLatencies)) {
      const { latencyMs } = result
      if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs)) continue

      minLatencyMs = minLatencyMs === undefined ? latencyMs : Math.min(minLatencyMs, latencyMs)
    }

    return minLatencyMs
  }, [nodeLatencies])

  const mergeNodeLatencyResults = useCallback(
    (results: NodeLatencyProbeResult[]) => {
      setManualLatencyProbeOverrides((previousResults) => {
        const nextResults = { ...previousResults }
        for (const result of results) {
          nextResults[result.id] = result
        }
        return nextResults
      })

      queryClient.setQueryData<NodeLatencyProbeResult[]>(QUERY_KEY_NODE_LATENCY, (previousResults = []) => {
        const resultMap = new Map(previousResults.map((result) => [result.id, result]))
        for (const result of results) {
          resultMap.set(result.id, result)
        }
        return Array.from(resultMap.values())
      })
    },
    [queryClient],
  )

  const refreshLatencyDependentViews = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY_NODE_LATENCY })
    void queryClient.invalidateQueries({ queryKey: webQueryKeys.group.summary() })
  }, [queryClient])

  // Get sorted node IDs
  const sortedNodeIds = nodeSortOrder

  // Get sorted nodes
  const sortedNodes = useMemo(() => {
    if (nodes.length === 0) return []
    const nodeMap = new Map(nodes.map((n: NodeListView['nodes']['items'][number]) => [n.id, n]))
    return sortedNodeIds.map((id) => nodeMap.get(id)).filter(Boolean) as typeof nodes
  }, [nodes, sortedNodeIds])

  // Get sorted subscription IDs
  const sortedSubscriptionIds = useMemo(() => {
    if (subscriptions.length === 0) return []
    const currentIds = subscriptions.map((s: SubscriptionListView['subscriptions'][number]) => s.id)
    return reconcileSortOrder(subscriptionSortOrder, currentIds)
  }, [subscriptions, subscriptionSortOrder])

  // Get sorted subscriptions
  const sortedSubscriptions = useMemo(() => {
    if (subscriptions.length === 0) return []
    const subMap = new Map(subscriptions.map((s: SubscriptionListView['subscriptions'][number]) => [s.id, s]))
    return sortedSubscriptionIds.map((id) => subMap.get(id)).filter(Boolean) as typeof subscriptions
  }, [subscriptions, sortedSubscriptionIds])

  const allLatencyProbeNodeIds = useMemo(() => {
    const nodeIDs = new Set<string>()

    for (const node of sortedNodes) {
      nodeIDs.add(node.id)
    }

    for (const node of subscriptionBackedNodes) {
      nodeIDs.add(node.id)
    }

    for (const subscription of sortedSubscriptions) {
      for (const node of subscription.nodes.items) {
        nodeIDs.add(node.id)
      }
    }

    return Array.from(nodeIDs)
  }, [sortedNodes, sortedSubscriptions, subscriptionBackedNodes])
  const latencyProbeFallbackTotal = Math.max(allLatencyProbeNodeIds.length, totalNodeCount)
  const {
    cancel: cancelManualLatencyProbe,
    cancelling: cancellingManualLatencyProbe,
    progress: manualLatencyProbeProgress,
    start: testAllNodeLatencies,
  } = useManualLatencyJob({
    fallbackTotal: latencyProbeFallbackTotal,
    onProbeResults: mergeNodeLatencyResults,
    onTerminal: refreshLatencyDependentViews,
  })

  useEffect(() => {
    const visibleNodeIdSet = new Set(allLatencyProbeNodeIds)
    const canonicalResultMap = new Map((nodeLatenciesQuery.data ?? []).map((result) => [result.id, result]))

    setManualLatencyProbeOverrides((previousResults) => {
      let changed = false
      const nextResults: Record<string, NodeLatencyProbeResult> = {}

      for (const [id, result] of Object.entries(previousResults)) {
        if (!visibleNodeIdSet.has(id)) {
          changed = true
          continue
        }

        const canonicalResult = canonicalResultMap.get(id)
        if (canonicalResult && canonicalResult.testedAt && result.testedAt) {
          const canonicalTime = Date.parse(canonicalResult.testedAt)
          const overrideTime = Date.parse(result.testedAt)
          if (!Number.isNaN(canonicalTime) && !Number.isNaN(overrideTime) && canonicalTime >= overrideTime) {
            changed = true
            continue
          }
        }

        nextResults[id] = result
      }

      return changed ? nextResults : previousResults
    })
  }, [allLatencyProbeNodeIds, nodeLatenciesQuery.data])

  const sortedGroupSummaryIds = groupSortOrder

  const sortedGroupSummaries = useMemo(() => {
    if (groupSummaries.length === 0) return []
    const groupMap = new Map(groupSummaries.map((group) => [group.id, group]))
    return sortedGroupSummaryIds.map((id) => groupMap.get(id)).filter(Boolean) as typeof groupSummaries
  }, [groupSummaries, sortedGroupSummaryIds])

  const sortedGroupIds = useMemo(() => {
    if (groups.length === 0) return []
    const currentIds = groups.map((group: GroupListView['groups'][number]) => group.id)
    return reconcileSortOrder(groupSortOrder, currentIds)
  }, [groupSortOrder, groups])

  const sortedGroups = useMemo(() => {
    if (groups.length === 0) return []
    const groupMap = new Map(groups.map((group: GroupListView['groups'][number]) => [group.id, group]))
    return sortedGroupIds.map((id) => groupMap.get(id)).filter(Boolean) as typeof groups
  }, [groups, sortedGroupIds])

  const { draggingResource, dragDestinationDroppableId, hoveredGroupId, onDragStart, onDragUpdate, onDragEnd } =
    useOrchestrateDrag({
      groupsQuery,
      sortedNodeIds,
      sortedSubscriptionIds,
      sortedGroupIds,
    })

  const matchSmallScreen = useMediaQuery('(max-width: 640px)')

  const openWorkspacePanel = useCallback(
    (panel: 'config' | 'dns' | 'routing' | 'group' | 'node' | 'subscription') => {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('panel', panel)
      setSearchParams(nextSearchParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const openSummaryGroupEdit = useCallback((groupId: string) => {
    setSummaryEditingGroupId(groupId)
    setSummaryGroupEditMode('actions')
  }, [])

  const closeSummaryGroupEdit = useCallback(() => {
    setSummaryGroupEditMode(null)
    setSummaryEditingGroupId(null)
  }, [])

  const closeWorkspacePanel = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('panel')
    setSearchParams(nextSearchParams, { replace: true })
  }, [searchParams, setSearchParams])
  const openConfigPanel = useCallback(() => openWorkspacePanel('config'), [openWorkspacePanel])
  const openGroupPanel = useCallback(() => openWorkspacePanel('group'), [openWorkspacePanel])
  const openNodePanel = useCallback(() => openWorkspacePanel('node'), [openWorkspacePanel])
  const openSubscriptionPanel = useCallback(() => openWorkspacePanel('subscription'), [openWorkspacePanel])

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {activeWorkspacePanel === 'log' ? (
        <section
          id={ORCHESTRATE_SECTION_IDS.log}
          className="h-[calc(100dvh-9rem)] min-h-[28rem] sm:h-[calc(100dvh-7.75rem)] sm:min-h-[32rem]"
        >
          <Suspense fallback={<PanelLoadingFallback />}>
            <LogResourcePanel />
          </Suspense>
        </section>
      ) : (
        <>
          <section id={ORCHESTRATE_SECTION_IDS.overview} className="scroll-mt-28">
            <TrafficOverviewIsland
              nodeCount={manualNodeCount}
              subscriptionCount={generalStateQuery?.general.counts.subscriptions ?? subscriptionSummaries.length}
              minLatencyMs={minLatencyMs}
            />
          </section>

          <WorkspaceSummaryCards
            selectedConfig={selectedConfig}
            configs={configSummariesQuery?.configs ?? EMPTY_CONFIG_SUMMARIES}
            groups={sortedGroupSummaries}
            sortedNodes={sortedNodes}
            subscriptionBackedNodes={subscriptionBackedNodes}
            subscriptions={subscriptionSummariesQuery?.subscriptions ?? EMPTY_SUBSCRIPTION_SUMMARIES}
            manualNodeCount={manualNodeCount}
            interfaces={interfaces ?? EMPTY_INTERFACES}
            geodata={geodata}
            nodeLatencies={nodeLatencies}
            onOpenConfig={openConfigPanel}
            onOpenGroup={openGroupPanel}
            onEditGroupResources={openSummaryGroupEdit}
            onOpenNodes={openNodePanel}
            onOpenSubscriptions={openSubscriptionPanel}
            onTestAllNodeLatencies={testAllNodeLatencies}
            onCancelNodeLatencies={cancelManualLatencyProbe}
            testingLatencies={manualLatencyProbeProgress !== null}
            cancellingLatencies={cancellingManualLatencyProbe}
            testingLatencyProgress={manualLatencyProbeProgress}
          />
        </>
      )}

      <GroupResourceEditor
        summaryEditingGroupId={summaryEditingGroupId}
        summaryGroupEditMode={summaryGroupEditMode}
        setSummaryGroupEditMode={setSummaryGroupEditMode}
        closeSummaryGroupEdit={closeSummaryGroupEdit}
        sortedGroups={sortedGroups}
        sortedGroupSummaries={sortedGroupSummaries}
        sortedNodes={sortedNodes}
        sortedSubscriptions={sortedSubscriptions}
        nodeLatencies={nodeLatencies}
      />

      <Dialog
        open={!!activeWorkspacePanel && activeWorkspacePanel !== 'log'}
        onOpenChange={(open) => !open && closeWorkspacePanel()}
      >
        <ScrollableDialogContent
          size="full"
          className={cn(matchSmallScreen ? 'h-[94dvh] w-[calc(100vw-0.75rem)]' : 'h-[92vh] w-[94vw] max-w-[1500px]')}
        >
          <ScrollableDialogHeader>
            <DialogTitle>
              {activeWorkspacePanel === 'config'
                ? 'Config'
                : activeWorkspacePanel === 'log'
                  ? t('log')
                  : activeWorkspacePanel === 'dns'
                    ? 'DNS'
                    : activeWorkspacePanel === 'routing'
                      ? 'Routing'
                      : activeWorkspacePanel === 'group'
                        ? 'Group'
                        : activeWorkspacePanel === 'node'
                          ? 'Node'
                          : activeWorkspacePanel === 'subscription'
                            ? 'Subscription'
                            : ''}
            </DialogTitle>
          </ScrollableDialogHeader>
          <ScrollableDialogBody className="p-4 sm:p-5">
            <Suspense fallback={<PanelLoadingFallback />}>
              {activeWorkspacePanel === 'config' && <ConfigPanel />}
              {activeWorkspacePanel === 'dns' && <DNSPanel />}
              {activeWorkspacePanel === 'routing' && <RoutingPanel />}
              {activeWorkspacePanel === 'group' && (
                <LazyDragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                  <GroupResourcePanel
                    highlight={!!draggingResource}
                    draggingResource={draggingResource}
                    dragDestinationDroppableId={dragDestinationDroppableId}
                    hoveredGroupId={hoveredGroupId}
                    nodeLatencies={nodeLatencies}
                  />
                </LazyDragDropContext>
              )}
              {activeWorkspacePanel === 'node' && (
                <LazyDragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                  <NodeResourcePanel
                    sortedNodes={sortedNodes}
                    highlight={draggingResource?.type === DraggableResourceType.groupNode}
                    nodeLatencies={nodeLatencies}
                  />
                </LazyDragDropContext>
              )}
              {activeWorkspacePanel === 'subscription' && (
                <LazyDragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                  <SubscriptionResourcePanel
                    sortedSubscriptions={sortedSubscriptions}
                    nodeLatencies={nodeLatencies}
                    testingLatencies={manualLatencyProbeProgress !== null}
                    cancellingLatencies={cancellingManualLatencyProbe}
                    testingLatencyProgress={manualLatencyProbeProgress}
                    lastLatencyProbeAt={lastLatencyProbeAt}
                    onTestAllNodeLatencies={testAllNodeLatencies}
                    onCancelNodeLatencies={cancelManualLatencyProbe}
                  />
                </LazyDragDropContext>
              )}
            </Suspense>
          </ScrollableDialogBody>
        </ScrollableDialogContent>
      </Dialog>
    </div>
  )
}
