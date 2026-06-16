import type { DragUpdate, DropResult } from '@hello-pangea/dnd'
import type { NodeLatencyProbeResult } from '~/apis'
import type { GroupListView, NodeListView, SubscriptionListView } from '~/apis/types'
import type { GroupPickerItem } from '~/components/GroupResourcePickerModal'
import type { DraggingResource } from '~/constants'
import { DragDropContext } from '@hello-pangea/dnd'
import { useStore } from '@nanostores/react'
import { useQueryClient } from '@tanstack/react-query'
import { ListPlus, Network } from 'lucide-react'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  useConfigsQuery,
  useGeneralQuery,
  useGroupAddNodesMutation,
  useGroupAddSubscriptionsMutation,
  useGroupDelNodesMutation,
  useGroupDelSubscriptionsMutation,
  useGroupsQuery,
  useNodeLatenciesQuery,
  useNodesQuery,
  useSubscriptionsQuery,
  useTestNodeLatenciesMutation,
  useTrafficOverviewQuery,
} from '~/apis'
import { GroupAddNodesModal, GroupAddSubscriptionsModal } from '~/components/GroupResourcePickerModal'
import { NodeProtocolBadge } from '~/components/NodeProtocolBadge'
import { Dialog, DialogTitle } from '~/components/ui/dialog'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'
import { DraggableResourceType, ORCHESTRATE_SECTION_IDS, QUERY_KEY_NODE_LATENCY } from '~/constants'
import { useMediaQuery } from '~/hooks'
import { cn } from '~/lib/utils'
import { appStateAtom, groupSortOrdersAtom } from '~/store'
import { deriveTime } from '~/utils'
import { Config } from './Config'
import { DNS } from './DNS'
import { GroupResource } from './Group'
import { LogResource } from './Logs'
import { NODE_DROPPABLE_ID, NodeResource } from './Node'
import { Routing } from './Routing'
import { SubscriptionResource } from './Subscription'
import { REALTIME_TRAFFIC_MAX_POINTS, REALTIME_TRAFFIC_WINDOW_SECONDS, TrafficOverview } from './TrafficOverview'
import { WorkspaceSummaryCards } from './WorkspaceSummaryCards'

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = [...array]
  const [removed] = newArray.splice(from, 1)
  newArray.splice(to, 0, removed)
  return newArray
}

function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) return [array]

  const chunks: T[][] = []
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }
  return chunks
}

const MANUAL_LATENCY_PROBE_BATCH_SIZE_FALLBACK = 8
const MANUAL_LATENCY_PROBE_BATCH_SIZE_MAX = 32
const MANUAL_LATENCY_PROBE_BATCH_TIMEOUT_MS = 8_000
const GROUP_NODE_ITEM_ID_PATTERN = /^(.+)-node-(.+)$/
const GROUP_SUBSCRIPTION_ITEM_ID_PATTERN = /^(.+)-sub-(.+)$/

type SummaryGroupEditMode = 'actions' | 'nodes' | 'subscriptions'

interface NodePickerCandidate {
  node: NodeListView['nodes']['items'][number]
  sourceLabel: string
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('manual latency probe batch timed out'))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}

function manualLatencyProbeBatchSizeFromRuntime(runtime: ReturnType<typeof useTrafficOverviewQuery>['data']) {
  const value = runtime?.runtime?.residentDataplane?.metrics?.resources?.manualProbe?.concurrency?.value
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return MANUAL_LATENCY_PROBE_BATCH_SIZE_FALLBACK
  }
  return Math.min(MANUAL_LATENCY_PROBE_BATCH_SIZE_MAX, Math.max(1, Math.floor(value)))
}

export function OrchestratePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { data: configsQuery } = useConfigsQuery()
  const { data: generalQuery } = useGeneralQuery()
  const { data: nodesQuery } = useNodesQuery()
  const { data: groupsQuery } = useGroupsQuery()
  const { data: subscriptionsQuery } = useSubscriptionsQuery()
  const trafficOverviewQuery = useTrafficOverviewQuery(REALTIME_TRAFFIC_WINDOW_SECONDS, REALTIME_TRAFFIC_MAX_POINTS)
  const runtimeOverview = trafficOverviewQuery.data

  const groupAddNodesMutation = useGroupAddNodesMutation()
  const groupAddSubscriptionsMutation = useGroupAddSubscriptionsMutation()
  const groupDelNodesMutation = useGroupDelNodesMutation()
  const groupDelSubscriptionsMutation = useGroupDelSubscriptionsMutation()
  const testNodeLatenciesMutation = useTestNodeLatenciesMutation()
  const [manualLatencyProbeProgress, setManualLatencyProbeProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const [manualLatencyProbeOverrides, setManualLatencyProbeOverrides] = useState<
    Record<string, NodeLatencyProbeResult>
  >({})

  const [draggingResource, setDraggingResource] = useState<DraggingResource | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragDestinationDroppableId, setDragDestinationDroppableId] = useState<string | null>(null)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [summaryEditingGroupId, setSummaryEditingGroupId] = useState<string | null>(null)
  const [summaryGroupEditMode, setSummaryGroupEditMode] = useState<SummaryGroupEditMode | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const draggingActiveRef = useRef(false)
  const edgeAutoScrollEnabledRef = useRef(false)
  const dragPointerRef = useRef<{ y: number } | null>(null)
  const hoveredGroupIdRef = useRef<string | null>(null)

  // Use persistent store for sort order
  const appState = useStore(appStateAtom)
  const nodeSortOrder = appState.nodeSortableKeys as string[]
  const subscriptionSortOrder = appState.subscriptionSortableKeys as string[]

  const setNodeSortOrder = useCallback((order: string[]) => {
    appStateAtom.setKey('nodeSortableKeys', order)
  }, [])

  const setSubscriptionSortOrder = useCallback((order: string[]) => {
    appStateAtom.setKey('subscriptionSortableKeys', order)
  }, [])

  const setGroupSortOrder = useCallback((order: string[]) => {
    appStateAtom.setKey('groupSortableKeys', order)
  }, [])

  // Get nodes from query (memoized to avoid dependency issues)
  const nodes = useMemo(() => nodesQuery?.nodes.items ?? [], [nodesQuery?.nodes.items])
  const groups = useMemo(() => groupsQuery?.groups ?? [], [groupsQuery?.groups])
  const subscriptions = useMemo(() => subscriptionsQuery?.subscriptions ?? [], [subscriptionsQuery?.subscriptions])
  const getGroupById = useCallback(
    (groupId: string) => groupsQuery?.groups.find((group: GroupListView['groups'][number]) => group.id === groupId),
    [groupsQuery?.groups],
  )
  const getGroupSubscriptionBinding = useCallback(
    (groupId: string, subscriptionId: string) =>
      getGroupById(groupId)?.subscriptions.find(
        (binding: GroupListView['groups'][number]['subscriptions'][number]) =>
          binding.subscription.id === subscriptionId,
      ),
    [getGroupById],
  )
  const hasGroupSubscription = useCallback(
    (groupId: string, subscriptionId: string) => !!getGroupSubscriptionBinding(groupId, subscriptionId),
    [getGroupSubscriptionBinding],
  )
  const selectedConfig = useMemo(() => configsQuery?.configs.find((config) => config.selected), [configsQuery?.configs])
  const [nodeLatenciesEnabled, setNodeLatenciesEnabled] = useState(false)
  const startupDataReady = !!configsQuery && !!nodesQuery && !!groupsQuery && !!subscriptionsQuery
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
  const totalNodeCount = useMemo(() => {
    const nodeIds = new Set<string>()

    for (const node of nodes) {
      nodeIds.add(node.id)
    }

    for (const subscription of subscriptions) {
      for (const node of subscription.nodes.items) {
        nodeIds.add(node.id)
      }
    }

    return nodeIds.size
  }, [nodes, subscriptions])
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

  // Get sorted node IDs
  const sortedNodeIds = useMemo(() => {
    if (nodes.length === 0) return []
    const currentIds = nodes.map((n: NodeListView['nodes']['items'][number]) => n.id)
    const currentIdSet = new Set(currentIds)

    const result = nodeSortOrder.filter((id) => currentIdSet.has(id))
    const resultSet = new Set(result)

    for (const id of currentIds) {
      if (!resultSet.has(id)) {
        result.push(id)
      }
    }

    return result
  }, [nodes, nodeSortOrder])

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
    const currentIdSet = new Set(currentIds)

    const result = subscriptionSortOrder.filter((id) => currentIdSet.has(id))
    const resultSet = new Set(result)

    for (const id of currentIds) {
      if (!resultSet.has(id)) {
        result.push(id)
      }
    }

    return result
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

    for (const subscription of sortedSubscriptions) {
      for (const node of subscription.nodes.items) {
        nodeIDs.add(node.id)
      }
    }

    return Array.from(nodeIDs)
  }, [sortedNodes, sortedSubscriptions])
  const manualLatencyProbeBatchSize = useMemo(
    () => manualLatencyProbeBatchSizeFromRuntime(runtimeOverview),
    [runtimeOverview],
  )

  const testAllNodeLatencies = useCallback(async () => {
    if (manualLatencyProbeProgress) return

    const nodeIDs = allLatencyProbeNodeIds
    if (nodeIDs.length === 0) return

    setManualLatencyProbeProgress({
      completed: 0,
      total: nodeIDs.length,
    })

    try {
      let completed = 0
      for (const nodeIDChunk of chunkArray(nodeIDs, manualLatencyProbeBatchSize)) {
        let results: NodeLatencyProbeResult[]
        try {
          results = await withTimeout(
            testNodeLatenciesMutation.mutateAsync(nodeIDChunk),
            MANUAL_LATENCY_PROBE_BATCH_TIMEOUT_MS,
          )
        } catch (error) {
          console.error('Failed to test node latency batch', error)
          const testedAt = new Date().toISOString()
          results = nodeIDChunk.map((id) => ({
            id,
            alive: false,
            testedAt,
            message: 'timeout',
          }))
        }

        mergeNodeLatencyResults(results)

        completed += nodeIDChunk.length
        setManualLatencyProbeProgress({
          completed,
          total: nodeIDs.length,
        })
      }

      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_NODE_LATENCY })
    } finally {
      setManualLatencyProbeProgress(null)
    }
  }, [
    allLatencyProbeNodeIds,
    manualLatencyProbeProgress,
    manualLatencyProbeBatchSize,
    mergeNodeLatencyResults,
    queryClient,
    testNodeLatenciesMutation,
  ])

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

  const groupSortOrder = appState.groupSortableKeys as string[]

  const sortedGroupIds = useMemo(() => {
    if (groups.length === 0) return []
    const currentIds = groups.map((group: GroupListView['groups'][number]) => group.id)
    const currentIdSet = new Set(currentIds)
    const result = groupSortOrder.filter((id) => currentIdSet.has(id))
    const resultSet = new Set(result)

    for (const id of currentIds) {
      if (!resultSet.has(id)) {
        result.push(id)
      }
    }

    return result
  }, [groupSortOrder, groups])

  const sortedGroups = useMemo(() => {
    if (groups.length === 0) return []
    const groupMap = new Map(groups.map((group: GroupListView['groups'][number]) => [group.id, group]))
    return sortedGroupIds.map((id) => groupMap.get(id)).filter(Boolean) as typeof groups
  }, [groups, sortedGroupIds])

  const summaryEditingGroup = useMemo(
    () => sortedGroups.find((group) => group.id === summaryEditingGroupId) ?? null,
    [sortedGroups, summaryEditingGroupId],
  )

  const summaryNodePickerCandidates = useMemo<NodePickerCandidate[]>(() => {
    const candidates: NodePickerCandidate[] = []
    const seenNodeIds = new Set<string>()
    const subscriptionNameById = new Map(
      sortedSubscriptions.map((subscription) => [subscription.id, subscription.tag || subscription.link]),
    )
    const pushNode = (node: NodeListView['nodes']['items'][number], sourceLabel: string) => {
      if (seenNodeIds.has(node.id)) return
      seenNodeIds.add(node.id)
      candidates.push({ node, sourceLabel })
    }

    for (const node of sortedNodes) {
      const subscriptionName = node.subscriptionID ? subscriptionNameById.get(node.subscriptionID) : undefined
      pushNode(
        node,
        node.subscriptionID
          ? t('groupPicker.fromSubscription', { name: subscriptionName ?? node.subscriptionID })
          : t('groupPicker.manualNode'),
      )
    }

    for (const subscription of sortedSubscriptions) {
      const subscriptionName = subscription.tag || subscription.link
      const sourceLabel = t('groupPicker.fromSubscription', { name: subscriptionName })
      for (const node of subscription.nodes.items) {
        pushNode(node, sourceLabel)
      }
    }

    return candidates
  }, [sortedNodes, sortedSubscriptions, t])

  const toSummaryNodePickerItem = useCallback(
    ({ node, sourceLabel }: NodePickerCandidate): GroupPickerItem => {
      const title = node.tag || node.name || node.address || node.id
      const description = [node.name && node.name !== title ? node.name : '', node.address].filter(Boolean).join(' · ')
      const latencyResult = nodeLatencies[node.id]
      const latency = formatLatencyMeta(latencyResult, t('latency.unavailable'))
      const latencyTone: GroupPickerItem['latencyTone'] =
        typeof latencyResult?.latencyMs === 'number' ? 'primary' : 'default'

      return {
        id: node.id,
        title,
        description: description || undefined,
        meta: sourceLabel,
        latency,
        latencyTone,
        badge: (
          <NodeProtocolBadge protocol={node.protocol} transport={node.transport} compact className="max-w-[5rem]" />
        ),
        keywords: [node.name, node.tag, node.address, node.protocol, node.transport, sourceLabel, latency].filter(
          Boolean,
        ) as string[],
      }
    },
    [nodeLatencies, t],
  )

  const summaryEditableNodeItems = useMemo<GroupPickerItem[]>(
    () => summaryNodePickerCandidates.map((candidate) => toSummaryNodePickerItem(candidate)),
    [summaryNodePickerCandidates, toSummaryNodePickerItem],
  )

  const summarySelectedNodeItemIds = useMemo(() => {
    if (!summaryEditingGroup) return []

    return summaryEditingGroup.nodes
      .map((node) => findNodePickerId(node, summaryNodePickerCandidates))
      .filter(Boolean) as string[]
  }, [summaryEditingGroup, summaryNodePickerCandidates])

  const summaryEditableSubscriptionItems = useMemo<GroupPickerItem[]>(
    () =>
      sortedSubscriptions.map((subscription) => {
        const title = subscription.tag || subscription.link
        const description = subscription.tag && subscription.tag !== subscription.link ? subscription.link : undefined

        return {
          id: subscription.id,
          title,
          description,
          meta: `${subscription.nodes.items.length} ${t('node')}`,
          previewNodes: subscription.nodes.items.map((node) => ({
            id: node.id,
            title: node.name,
            protocol: node.protocol || undefined,
            transport: node.transport || undefined,
          })),
          keywords: [subscription.tag, subscription.link, subscription.status, subscription.info].filter(
            Boolean,
          ) as string[],
        }
      }),
    [sortedSubscriptions, t],
  )

  const summarySelectedSubscriptionItemIds = useMemo(
    () => summaryEditingGroup?.subscriptions.map((binding) => binding.subscription.id) ?? [],
    [summaryEditingGroup],
  )

  // Helper to parse group item IDs (format: groupId-node-nodeId or groupId-sub-subId)
  const parseGroupItemId = useCallback(
    (id: string): { groupId: string; type: 'node' | 'sub'; itemId: string } | null => {
      const nodeMatch = id.match(GROUP_NODE_ITEM_ID_PATTERN)
      if (nodeMatch) {
        return { groupId: nodeMatch[1], type: 'node', itemId: nodeMatch[2] }
      }
      const subMatch = id.match(GROUP_SUBSCRIPTION_ITEM_ID_PATTERN)
      if (subMatch) {
        return { groupId: subMatch[1], type: 'sub', itemId: subMatch[2] }
      }
      return null
    },
    [],
  )

  // Helper to update group sort order
  const updateGroupSortOrder = useCallback((groupId: string, type: 'nodes' | 'subscriptions', newOrder: string[]) => {
    const currentOrders = groupSortOrdersAtom.get()
    groupSortOrdersAtom.set({
      ...currentOrders,
      [groupId]: {
        nodes: type === 'nodes' ? newOrder : currentOrders[groupId]?.nodes || [],
        subscriptions: type === 'subscriptions' ? newOrder : currentOrders[groupId]?.subscriptions || [],
      },
    })
  }, [])

  // Get sorted IDs for a group
  const getGroupSortedIds = useCallback((groupId: string, type: 'nodes' | 'subscriptions', currentIds: string[]) => {
    const groupSortOrders = groupSortOrdersAtom.get()
    const sortOrder = groupSortOrders[groupId]?.[type] || []
    const currentIdSet = new Set(currentIds)

    const result = sortOrder.filter((id) => currentIdSet.has(id))
    const resultSet = new Set(result)

    for (const id of currentIds) {
      if (!resultSet.has(id)) {
        result.push(id)
      }
    }

    return result
  }, [])

  const stopEdgeAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  const tickEdgeAutoScroll = useCallback(() => {
    autoScrollFrameRef.current = null

    if (!draggingActiveRef.current || !edgeAutoScrollEnabledRef.current || !dragPointerRef.current) return

    const viewportHeight = window.innerHeight
    const threshold = Math.min(320, Math.max(180, Math.round(viewportHeight * 0.3)))
    const pointerY = dragPointerRef.current.y
    let delta = 0

    if (pointerY < threshold) {
      const intensity = Math.min(1, (threshold - pointerY) / threshold)
      delta = -Math.round(24 + intensity * intensity * 176)
    } else if (pointerY > viewportHeight - threshold) {
      const intensity = Math.min(1, (pointerY - (viewportHeight - threshold)) / threshold)
      delta = Math.round(24 + intensity * intensity * 176)
    }

    if (delta === 0) return

    window.scrollBy(0, delta)
    autoScrollFrameRef.current = window.requestAnimationFrame(tickEdgeAutoScroll)
  }, [])

  const ensureEdgeAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(tickEdgeAutoScroll)
    }
  }, [tickEdgeAutoScroll])

  useEffect(() => {
    draggingActiveRef.current = isDragging

    if (!isDragging) {
      edgeAutoScrollEnabledRef.current = false
      hoveredGroupIdRef.current = null
      setHoveredGroupId(null)
      stopEdgeAutoScroll()
      return
    }

    edgeAutoScrollEnabledRef.current = true

    const handlePointerMove = (event: MouseEvent | PointerEvent) => {
      dragPointerRef.current = {
        y: event.clientY,
      }

      const hoveredCard = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-group-card-id]')
      const nextHoveredGroupId = hoveredCard?.getAttribute('data-group-card-id') ?? null

      if (hoveredGroupIdRef.current !== nextHoveredGroupId) {
        hoveredGroupIdRef.current = nextHoveredGroupId
        setHoveredGroupId(nextHoveredGroupId)
      }

      if (edgeAutoScrollEnabledRef.current) {
        ensureEdgeAutoScroll()
      }
    }

    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [ensureEdgeAutoScroll, isDragging, stopEdgeAutoScroll])

  useEffect(() => () => stopEdgeAutoScroll(), [stopEdgeAutoScroll])

  const onDragStart = (start: { draggableId: string; source: { droppableId: string } }) => {
    const draggableId = start.draggableId
    const droppableId = start.source.droppableId

    setIsDragging(true)
    setDragDestinationDroppableId(null)
    hoveredGroupIdRef.current = null
    setHoveredGroupId(null)
    edgeAutoScrollEnabledRef.current = true
    ensureEdgeAutoScroll()

    // Determine the type based on droppableId
    if (droppableId === 'group-list') {
      setDraggingResource(null)
      return
    }

    if (droppableId === 'node-list') {
      const nodeId = draggableId.replace('node-', '')
      setDraggingResource({ type: DraggableResourceType.node, nodeID: nodeId })
    } else if (droppableId === 'subscription-list') {
      const subId = draggableId.replace('subscription-', '')
      setDraggingResource({ type: DraggableResourceType.subscription, subscriptionID: subId })
    } else if (droppableId.startsWith('subscription-') && droppableId.endsWith('-nodes')) {
      // Subscription node dragged from a subscription's node list
      const nodeId = draggableId.replace('subscription-node-', '')
      setDraggingResource({ type: DraggableResourceType.subscription_node, nodeID: nodeId })
    } else if (droppableId.endsWith('-nodes')) {
      const groupId = droppableId.replace('-nodes', '')
      const parsed = parseGroupItemId(draggableId)
      if (parsed) {
        setDraggingResource({ type: DraggableResourceType.groupNode, nodeID: parsed.itemId, groupID: groupId })
      }
    } else if (droppableId.endsWith('-subscriptions')) {
      const groupId = droppableId.replace('-subscriptions', '')
      const parsed = parseGroupItemId(draggableId)
      if (parsed) {
        setDraggingResource({
          type: DraggableResourceType.groupSubscription,
          subscriptionID: parsed.itemId,
          groupID: groupId,
        })
      }
    }
  }

  const onDragUpdate = useCallback(
    (update: DragUpdate) => {
      const nextDroppableId = update.destination?.droppableId ?? null
      setDragDestinationDroppableId((current) => (current === nextDroppableId ? current : nextDroppableId))
      ensureEdgeAutoScroll()
    },
    [ensureEdgeAutoScroll],
  )

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result
    const fallbackGroupId = hoveredGroupIdRef.current

    setIsDragging(false)
    setDraggingResource(null)
    setDragDestinationDroppableId(null)
    setHoveredGroupId(null)
    hoveredGroupIdRef.current = null
    edgeAutoScrollEnabledRef.current = false
    stopEdgeAutoScroll()

    const sourceDroppableId = source.droppableId
    const destDroppableId = destination?.droppableId

    if (sourceDroppableId === 'group-list' && destDroppableId === 'group-list' && destination) {
      if (source.index !== destination.index) {
        setGroupSortOrder(arrayMove(sortedGroupIds, source.index, destination.index))
      }
      return
    }

    if (!destination) {
      if (fallbackGroupId) {
        if (sourceDroppableId === 'subscription-list') {
          const subId = draggableId.replace('subscription-', '')
          const targetGroup = getGroupById(fallbackGroupId)
          if (targetGroup && !hasGroupSubscription(fallbackGroupId, subId)) {
            groupAddSubscriptionsMutation.mutate({ id: fallbackGroupId, subscriptionIDs: [subId] })
            return
          }
        }

        if (sourceDroppableId === 'node-list') {
          const nodeId = draggableId.replace('node-', '')
          const targetGroup = groupsQuery?.groups.find(
            (group: GroupListView['groups'][number]) => group.id === fallbackGroupId,
          )
          if (
            targetGroup &&
            !targetGroup.nodes.some((node: GroupListView['groups'][number]['nodes'][number]) => node.id === nodeId)
          ) {
            groupAddNodesMutation.mutate({ id: fallbackGroupId, nodeIDs: [nodeId] })
            return
          }
        }

        if (
          sourceDroppableId.startsWith('subscription-') &&
          sourceDroppableId.endsWith('-nodes') &&
          sourceDroppableId !== 'subscription-list'
        ) {
          const nodeId = draggableId.replace('subscription-node-', '')
          const targetGroup = groupsQuery?.groups.find(
            (group: GroupListView['groups'][number]) => group.id === fallbackGroupId,
          )
          if (
            targetGroup &&
            !targetGroup.nodes.some((node: GroupListView['groups'][number]['nodes'][number]) => node.id === nodeId)
          ) {
            groupAddNodesMutation.mutate({ id: fallbackGroupId, nodeIDs: [nodeId] })
            return
          }
        }

        if (sourceDroppableId.endsWith('-nodes')) {
          const sourceGroupId = sourceDroppableId.replace('-nodes', '')
          const parsed = parseGroupItemId(draggableId)
          if (parsed && sourceGroupId !== fallbackGroupId) {
            const targetGroup = groupsQuery?.groups.find(
              (group: GroupListView['groups'][number]) => group.id === fallbackGroupId,
            )
            if (
              targetGroup &&
              !targetGroup.nodes.some(
                (node: GroupListView['groups'][number]['nodes'][number]) => node.id === parsed.itemId,
              )
            ) {
              groupAddNodesMutation.mutate({ id: fallbackGroupId, nodeIDs: [parsed.itemId] })
              return
            }
          }
        }

        if (sourceDroppableId.endsWith('-subscriptions')) {
          const sourceGroupId = sourceDroppableId.replace('-subscriptions', '')
          const parsed = parseGroupItemId(draggableId)
          if (parsed && sourceGroupId !== fallbackGroupId) {
            const targetGroup = getGroupById(fallbackGroupId)
            const sourceBinding = getGroupSubscriptionBinding(sourceGroupId, parsed.itemId)
            if (targetGroup && !hasGroupSubscription(fallbackGroupId, parsed.itemId)) {
              groupAddSubscriptionsMutation.mutate({
                id: fallbackGroupId,
                subscriptionIDs: [parsed.itemId],
                nameFilterRegex: sourceBinding?.nameFilterRegex ?? null,
              })
              return
            }
          }
        }
      }

      return
    }

    const confirmedDestDroppableId = destination.droppableId

    // Handle node list sorting
    if (sourceDroppableId === 'node-list' && confirmedDestDroppableId === 'node-list') {
      if (source.index !== destination.index) {
        setNodeSortOrder(arrayMove(sortedNodeIds, source.index, destination.index))
      }
      return
    }

    // Handle subscription list sorting
    if (sourceDroppableId === 'subscription-list' && confirmedDestDroppableId === 'subscription-list') {
      if (source.index !== destination.index) {
        setSubscriptionSortOrder(arrayMove(sortedSubscriptionIds, source.index, destination.index))
      }
      return
    }

    // Check if source is a subscription's node list (format: subscription-{id}-nodes)
    const isFromSubscriptionNodes =
      sourceDroppableId.startsWith('subscription-') &&
      sourceDroppableId.endsWith('-nodes') &&
      sourceDroppableId !== 'subscription-list'

    // Handle dropping subscription node to group
    if (isFromSubscriptionNodes && confirmedDestDroppableId.endsWith('-nodes')) {
      const nodeId = draggableId.replace('subscription-node-', '')
      const targetGroupId = confirmedDestDroppableId.replace('-nodes', '')
      const targetGroup = groupsQuery?.groups.find((g: GroupListView['groups'][number]) => g.id === targetGroupId)

      if (
        targetGroup &&
        !targetGroup.nodes.some((n: GroupListView['groups'][number]['nodes'][number]) => n.id === nodeId)
      ) {
        groupAddNodesMutation.mutate({ id: targetGroupId, nodeIDs: [nodeId] })
      }
      return
    }

    // Handle group node sorting within same group OR cross-group drag
    if (sourceDroppableId.endsWith('-nodes') && confirmedDestDroppableId.endsWith('-nodes')) {
      const sourceGroupId = sourceDroppableId.replace('-nodes', '')
      const destGroupId = confirmedDestDroppableId.replace('-nodes', '')

      if (sourceGroupId === destGroupId) {
        // Same group sorting
        if (source.index !== destination.index) {
          const group = groupsQuery?.groups.find((g: GroupListView['groups'][number]) => g.id === sourceGroupId)
          if (group) {
            const currentIds = group.nodes.map((n: GroupListView['groups'][number]['nodes'][number]) => n.id)
            const sortedIds = getGroupSortedIds(sourceGroupId, 'nodes', currentIds)
            updateGroupSortOrder(sourceGroupId, 'nodes', arrayMove(sortedIds, source.index, destination.index))
          }
        }
      } else {
        // Cross-group drag - add node to target group
        const parsed = parseGroupItemId(draggableId)
        if (parsed) {
          const targetGroup = groupsQuery?.groups.find((g: GroupListView['groups'][number]) => g.id === destGroupId)
          if (
            targetGroup &&
            !targetGroup.nodes.some((n: GroupListView['groups'][number]['nodes'][number]) => n.id === parsed.itemId)
          ) {
            groupAddNodesMutation.mutate({ id: destGroupId, nodeIDs: [parsed.itemId] })
          }
        }
      }
      return
    }

    // Handle group subscription sorting within same group OR cross-group drag
    if (sourceDroppableId.endsWith('-subscriptions') && confirmedDestDroppableId.endsWith('-subscriptions')) {
      const sourceGroupId = sourceDroppableId.replace('-subscriptions', '')
      const destGroupId = confirmedDestDroppableId.replace('-subscriptions', '')

      if (sourceGroupId === destGroupId) {
        // Same group sorting
        if (source.index !== destination.index) {
          const group = groupsQuery?.groups.find((g: GroupListView['groups'][number]) => g.id === sourceGroupId)
          if (group) {
            const currentIds = group.subscriptions.map(
              (s: GroupListView['groups'][number]['subscriptions'][number]) => s.subscription.id,
            )
            const sortedIds = getGroupSortedIds(sourceGroupId, 'subscriptions', currentIds)
            updateGroupSortOrder(sourceGroupId, 'subscriptions', arrayMove(sortedIds, source.index, destination.index))
          }
        }
      } else {
        // Cross-group drag - add subscription to target group
        const parsed = parseGroupItemId(draggableId)
        if (parsed) {
          const targetGroup = getGroupById(destGroupId)
          const sourceBinding = getGroupSubscriptionBinding(sourceGroupId, parsed.itemId)
          if (targetGroup && !hasGroupSubscription(destGroupId, parsed.itemId)) {
            groupAddSubscriptionsMutation.mutate({
              id: destGroupId,
              subscriptionIDs: [parsed.itemId],
              nameFilterRegex: sourceBinding?.nameFilterRegex ?? null,
            })
          }
        }
      }
      return
    }

    // Handle dropping node from node-list to group
    if (sourceDroppableId === 'node-list' && confirmedDestDroppableId.endsWith('-nodes')) {
      const nodeId = draggableId.replace('node-', '')
      const targetGroupId = confirmedDestDroppableId.replace('-nodes', '')
      const targetGroup = groupsQuery?.groups.find((g: GroupListView['groups'][number]) => g.id === targetGroupId)

      if (
        targetGroup &&
        !targetGroup.nodes.some((n: GroupListView['groups'][number]['nodes'][number]) => n.id === nodeId)
      ) {
        groupAddNodesMutation.mutate({ id: targetGroupId, nodeIDs: [nodeId] })
      }
      return
    }

    // Handle dropping subscription from subscription-list to group
    if (sourceDroppableId === 'subscription-list' && confirmedDestDroppableId.endsWith('-subscriptions')) {
      const subId = draggableId.replace('subscription-', '')
      const targetGroupId = confirmedDestDroppableId.replace('-subscriptions', '')
      const targetGroup = getGroupById(targetGroupId)

      if (targetGroup && !hasGroupSubscription(targetGroupId, subId)) {
        groupAddSubscriptionsMutation.mutate({ id: targetGroupId, subscriptionIDs: [subId] })
      }
      return
    }

    // Handle dropping group node back to node list (remove from group)
    if (sourceDroppableId.endsWith('-nodes') && confirmedDestDroppableId === NODE_DROPPABLE_ID) {
      const sourceGroupId = sourceDroppableId.replace('-nodes', '')
      const parsed = parseGroupItemId(draggableId)
      if (parsed) {
        groupDelNodesMutation.mutate({ id: sourceGroupId, nodeIDs: [parsed.itemId] })
      }
    }
  }

  const matchSmallScreen = useMediaQuery('(max-width: 640px)')

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

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {activeWorkspacePanel === 'log' ? (
        <section
          id={ORCHESTRATE_SECTION_IDS.log}
          className="h-[calc(100dvh-9rem)] min-h-[28rem] sm:h-[calc(100dvh-7.75rem)] sm:min-h-[32rem]"
        >
          <LogResource />
        </section>
      ) : (
        <>
          <section id={ORCHESTRATE_SECTION_IDS.overview} className="scroll-mt-28">
            <TrafficOverview
              runtimeOverview={runtimeOverview}
              nodeCount={totalNodeCount}
              subscriptionCount={subscriptions.length}
              minLatencyMs={minLatencyMs}
            />
          </section>

          <WorkspaceSummaryCards
            selectedConfig={selectedConfig}
            configs={configsQuery?.configs ?? []}
            groups={sortedGroups}
            sortedNodes={sortedNodes}
            subscriptions={sortedSubscriptions}
            interfaces={generalQuery?.general.interfaces ?? []}
            nodeLatencies={nodeLatencies}
            onOpenConfig={() => openWorkspacePanel('config')}
            onOpenGroup={() => openWorkspacePanel('group')}
            onEditGroupResources={openSummaryGroupEdit}
            onOpenNodes={() => openWorkspacePanel('node')}
            onOpenSubscriptions={() => openWorkspacePanel('subscription')}
            onTestAllNodeLatencies={testAllNodeLatencies}
            testingLatencies={manualLatencyProbeProgress !== null}
            testingLatencyProgress={manualLatencyProbeProgress}
          />
        </>
      )}

      <Dialog open={summaryGroupEditMode === 'actions'} onOpenChange={(open) => !open && closeSummaryGroupEdit()}>
        <ScrollableDialogContent size="md">
          <ScrollableDialogHeader>
            <DialogTitle>
              {t('groupPicker.editGroupResourcesTitle', { name: summaryEditingGroup?.name || t('group') })}
            </DialogTitle>
          </ScrollableDialogHeader>
          <ScrollableDialogBody className="grid gap-3 p-4 sm:p-5">
            <button
              type="button"
              className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-border bg-accent/40 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/55 focus-visible:border-primary/40 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
              disabled={!summaryEditingGroup}
              onClick={() => setSummaryGroupEditMode('nodes')}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <ListPlus className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {t('groupPicker.editNodePicker')}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {t('groupPicker.nodesCount', { count: summaryEditingGroup?.nodes.length ?? 0 })}
                </span>
              </span>
            </button>

            <button
              type="button"
              className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-border bg-accent/40 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/55 focus-visible:border-primary/40 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
              disabled={!summaryEditingGroup}
              onClick={() => setSummaryGroupEditMode('subscriptions')}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Network className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {t('groupPicker.editSubscriptionPicker')}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {t('groupPicker.subscriptionGroupsCount', {
                    count: summaryEditingGroup?.subscriptions.length ?? 0,
                  })}
                </span>
              </span>
            </button>
          </ScrollableDialogBody>
        </ScrollableDialogContent>
      </Dialog>

      <GroupAddNodesModal
        opened={summaryGroupEditMode === 'nodes'}
        onClose={closeSummaryGroupEdit}
        groupName={summaryEditingGroup?.name || t('group')}
        title={t('groupPicker.editNodesTitle', { name: summaryEditingGroup?.name || t('group') })}
        submitLabel={t('groupPicker.saveNodeSelection')}
        items={summaryEditableNodeItems}
        initialSelectedIds={summarySelectedNodeItemIds}
        allowEmptySubmit
        loading={groupAddNodesMutation.isPending || groupDelNodesMutation.isPending}
        resetKey={summaryEditingGroupId || ''}
        onSubmit={async (nodeIDs) => {
          if (!summaryEditingGroupId || !summaryEditingGroup) return

          const selectedNodeIds = new Set(nodeIDs)
          const existingNodeItemIds = new Set(summarySelectedNodeItemIds)
          const nodeIDsToAdd = nodeIDs.filter((nodeID) => !existingNodeItemIds.has(nodeID))
          const nodeIDsToDelete = summaryEditingGroup.nodes
            .filter((node) => {
              const pickerId = findNodePickerId(node, summaryNodePickerCandidates)
              return pickerId ? !selectedNodeIds.has(pickerId) : false
            })
            .map((node) => node.id)

          await Promise.all([
            nodeIDsToAdd.length
              ? groupAddNodesMutation.mutateAsync({
                  id: summaryEditingGroupId,
                  nodeIDs: nodeIDsToAdd,
                })
              : Promise.resolve(),
            nodeIDsToDelete.length
              ? groupDelNodesMutation.mutateAsync({
                  id: summaryEditingGroupId,
                  nodeIDs: nodeIDsToDelete,
                })
              : Promise.resolve(),
          ])
        }}
      />

      <GroupAddSubscriptionsModal
        opened={summaryGroupEditMode === 'subscriptions'}
        onClose={closeSummaryGroupEdit}
        groupName={summaryEditingGroup?.name || t('group')}
        title={t('groupPicker.editSubscriptionsTitle', { name: summaryEditingGroup?.name || t('group') })}
        submitLabel={t('groupPicker.saveSubscriptionSelection')}
        items={summaryEditableSubscriptionItems}
        initialSelectedIds={summarySelectedSubscriptionItemIds}
        allowEmptySubmit
        loading={groupAddSubscriptionsMutation.isPending || groupDelSubscriptionsMutation.isPending}
        resetKey={summaryEditingGroupId || ''}
        onSubmit={async ({ ids: subscriptionIDs, nameFilterRegex }) => {
          if (!summaryEditingGroupId || !summaryEditingGroup) return

          const selectedSubscriptionIds = new Set(subscriptionIDs)
          const existingSubscriptionIds = new Set(
            summaryEditingGroup.subscriptions.map((binding) => binding.subscription.id),
          )
          const subscriptionIDsToAdd = subscriptionIDs.filter(
            (subscriptionID) => !existingSubscriptionIds.has(subscriptionID),
          )
          const subscriptionIDsToDelete = summaryEditingGroup.subscriptions
            .filter((binding) => !selectedSubscriptionIds.has(binding.subscription.id))
            .map((binding) => binding.subscription.id)

          await Promise.all([
            subscriptionIDsToAdd.length
              ? groupAddSubscriptionsMutation.mutateAsync({
                  id: summaryEditingGroupId,
                  subscriptionIDs: subscriptionIDsToAdd,
                  nameFilterRegex,
                })
              : Promise.resolve(),
            subscriptionIDsToDelete.length
              ? groupDelSubscriptionsMutation.mutateAsync({
                  id: summaryEditingGroupId,
                  subscriptionIDs: subscriptionIDsToDelete,
                })
              : Promise.resolve(),
          ])
        }}
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
            {activeWorkspacePanel === 'config' && <Config />}
            {activeWorkspacePanel === 'dns' && <DNS />}
            {activeWorkspacePanel === 'routing' && <Routing />}
            {activeWorkspacePanel === 'group' && (
              <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                <GroupResource
                  highlight={!!draggingResource}
                  draggingResource={draggingResource}
                  dragDestinationDroppableId={dragDestinationDroppableId}
                  hoveredGroupId={hoveredGroupId}
                  nodeLatencies={nodeLatencies}
                />
              </DragDropContext>
            )}
            {activeWorkspacePanel === 'node' && (
              <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                <NodeResource
                  sortedNodes={sortedNodes}
                  highlight={draggingResource?.type === DraggableResourceType.groupNode}
                  nodeLatencies={nodeLatencies}
                />
              </DragDropContext>
            )}
            {activeWorkspacePanel === 'subscription' && (
              <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
                <SubscriptionResource
                  sortedSubscriptions={sortedSubscriptions}
                  nodeLatencies={nodeLatencies}
                  testingLatencies={manualLatencyProbeProgress !== null}
                  testingLatencyProgress={manualLatencyProbeProgress}
                  lastLatencyProbeAt={lastLatencyProbeAt}
                  onTestAllNodeLatencies={testAllNodeLatencies}
                />
              </DragDropContext>
            )}
          </ScrollableDialogBody>
        </ScrollableDialogContent>
      </Dialog>
    </div>
  )
}

function formatLatencyMeta(result: NodeLatencyProbeResult | undefined, unavailableLabel: string) {
  if (!result) {
    return unavailableLabel
  }
  if (typeof result.latencyMs === 'number') {
    return result.message ? `${result.latencyMs} ms · ${result.message}` : `${result.latencyMs} ms`
  }
  if (result.message) {
    return result.message === 'no latency result' ? unavailableLabel : result.message
  }
  return unavailableLabel
}

function getNodeIdentityKeys(node: {
  id?: string | null
  tag?: string | null
  name?: string | null
  link?: string | null
  address?: string | null
}) {
  return [
    node.id ? `id:${node.id}` : null,
    node.tag ? `tag:${node.tag}` : null,
    node.name ? `name:${node.name}` : null,
    node.link ? `link:${node.link}` : null,
    node.address ? `address:${node.address}` : null,
  ].filter(Boolean) as string[]
}

function findNodePickerId(
  node: {
    id?: string | null
    tag?: string | null
    name?: string | null
    link?: string | null
    address?: string | null
  },
  candidates: NodePickerCandidate[],
) {
  const nodeKeys = new Set(getNodeIdentityKeys(node))
  return candidates.find(({ node: candidate }) => getNodeIdentityKeys(candidate).some((key) => nodeKeys.has(key)))?.node
    .id
}
