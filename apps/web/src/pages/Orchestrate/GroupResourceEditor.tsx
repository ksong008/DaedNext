import type { NodeLatencyProbeResult } from '~/apis'
import type { GroupListView, GroupSummaryResource, NodeListView, SubscriptionListView } from '~/apis/types'
import type { GroupPickerItem } from '~/components/GroupResourcePickerModal'
import { ListPlus, Network } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useGroupAddNodesMutation,
  useGroupAddSubscriptionsMutation,
  useGroupDelNodesMutation,
  useGroupDelSubscriptionsMutation,
  useGroupReplaceNodesMutation,
} from '~/apis'
import { Policy } from '~/apis/types'
import { GroupAddNodesModal, GroupAddSubscriptionsModal } from '~/components/GroupResourcePickerModal'
import { NodeProtocolBadge } from '~/components/NodeProtocolBadge'
import { Dialog, DialogTitle } from '~/components/ui/dialog'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'
import { formatNodeLatencyCardLabel, getNodeLatencyCardTone } from '~/utils/node_display'

export type SummaryGroupEditMode = 'actions' | 'nodes' | 'subscriptions'

interface NodePickerCandidate {
  node: NodeListView['nodes']['items'][number]
  sourceLabel: string
}

interface GroupResourceEditorProps {
  summaryEditingGroupId: string | null
  summaryGroupEditMode: SummaryGroupEditMode | null
  setSummaryGroupEditMode: (mode: SummaryGroupEditMode) => void
  closeSummaryGroupEdit: () => void
  sortedGroups: GroupListView['groups']
  sortedGroupSummaries: GroupSummaryResource[]
  sortedNodes: NodeListView['nodes']['items']
  sortedSubscriptions: SubscriptionListView['subscriptions']
  nodeLatencies: Record<string, NodeLatencyProbeResult>
}

export function GroupResourceEditor({
  summaryEditingGroupId,
  summaryGroupEditMode,
  setSummaryGroupEditMode,
  closeSummaryGroupEdit,
  sortedGroups,
  sortedGroupSummaries,
  sortedNodes,
  sortedSubscriptions,
  nodeLatencies,
}: GroupResourceEditorProps) {
  const { t } = useTranslation()
  const groupAddNodesMutation = useGroupAddNodesMutation()
  const groupAddSubscriptionsMutation = useGroupAddSubscriptionsMutation()
  const groupDelNodesMutation = useGroupDelNodesMutation()
  const groupDelSubscriptionsMutation = useGroupDelSubscriptionsMutation()
  const groupReplaceNodesMutation = useGroupReplaceNodesMutation()
  const summaryEditingGroup = useMemo(
    () => sortedGroups.find((group) => group.id === summaryEditingGroupId) ?? null,
    [sortedGroups, summaryEditingGroupId],
  )
  const summaryEditingGroupSummary = useMemo(
    () => sortedGroupSummaries.find((group) => group.id === summaryEditingGroupId) ?? null,
    [sortedGroupSummaries, summaryEditingGroupId],
  )
  const summaryEditingGroupName = summaryEditingGroup?.name || summaryEditingGroupSummary?.name || t('group')
  const summaryEditingGroupAvailable = !!summaryEditingGroup || !!summaryEditingGroupSummary
  const summaryEditingGroupNodeCount = summaryEditingGroup?.nodes.length ?? summaryEditingGroupSummary?.nodeCount ?? 0
  const summaryEditingGroupSubscriptionCount =
    summaryEditingGroup?.subscriptions.length ?? summaryEditingGroupSummary?.subscriptionCount ?? 0

  const summaryNodePickerCandidates = useMemo<NodePickerCandidate[]>(() => {
    if (summaryGroupEditMode !== 'nodes') return []

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
  }, [sortedNodes, sortedSubscriptions, summaryGroupEditMode, t])

  const toSummaryNodePickerItem = useCallback(
    ({ node, sourceLabel }: NodePickerCandidate): GroupPickerItem => {
      const title = node.tag || node.name || node.address || node.id
      const description = [node.name && node.name !== title ? node.name : '', node.address].filter(Boolean).join(' · ')
      const latencyResult = nodeLatencies[node.id]
      const latency = formatNodeLatencyCardLabel(latencyResult, t('latency.unavailable'))
      const latencyCardTone = getNodeLatencyCardTone(latencyResult)
      const latencyTone: GroupPickerItem['latencyTone'] =
        latencyCardTone === 'success' ? 'primary' : latencyCardTone === 'failure' ? 'destructive' : 'default'

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
    if (summaryGroupEditMode !== 'nodes' || !summaryEditingGroup) return []

    return summaryEditingGroup.nodes
      .map((node) => findNodePickerId(node, summaryNodePickerCandidates))
      .filter(Boolean) as string[]
  }, [summaryEditingGroup, summaryGroupEditMode, summaryNodePickerCandidates])

  const summaryEditableSubscriptionItems = useMemo<GroupPickerItem[]>(() => {
    if (summaryGroupEditMode !== 'subscriptions') return []

    return sortedSubscriptions.map((subscription) => {
      const title = subscription.tag || subscription.link
      const description = subscription.tag && subscription.tag !== subscription.link ? subscription.link : undefined

      return {
        id: subscription.id,
        title,
        description,
        meta: `${subscription.nodes.items.length} ${t('node')}`,
        keywords: [subscription.tag, subscription.link, subscription.status, subscription.info].filter(
          Boolean,
        ) as string[],
      }
    })
  }, [sortedSubscriptions, summaryGroupEditMode, t])

  const summarySelectedSubscriptionItemIds = useMemo(
    () =>
      summaryGroupEditMode === 'subscriptions'
        ? (summaryEditingGroup?.subscriptions.map((binding) => binding.subscription.id) ?? [])
        : [],
    [summaryEditingGroup, summaryGroupEditMode],
  )

  return (
    <>
      <Dialog open={summaryGroupEditMode === 'actions'} onOpenChange={(open) => !open && closeSummaryGroupEdit()}>
        <ScrollableDialogContent size="md">
          <ScrollableDialogHeader>
            <DialogTitle>{t('groupPicker.editGroupResourcesTitle', { name: summaryEditingGroupName })}</DialogTitle>
          </ScrollableDialogHeader>
          <ScrollableDialogBody className="grid gap-3 p-4 sm:p-5">
            <button
              type="button"
              className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-border bg-accent/40 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/55 focus-visible:border-primary/40 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
              disabled={!summaryEditingGroupAvailable}
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
                  {t('groupPicker.nodesCount', { count: summaryEditingGroupNodeCount })}
                </span>
              </span>
            </button>

            <button
              type="button"
              className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-border bg-accent/40 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/55 focus-visible:border-primary/40 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
              disabled={!summaryEditingGroupAvailable}
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
                    count: summaryEditingGroupSubscriptionCount,
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
        groupName={summaryEditingGroupName}
        title={t('groupPicker.editNodesTitle', { name: summaryEditingGroupName })}
        submitLabel={t('groupPicker.saveNodeSelection')}
        items={summaryEditableNodeItems}
        initialSelectedIds={summarySelectedNodeItemIds}
        allowEmptySubmit
        loading={
          groupAddNodesMutation.isPending || groupDelNodesMutation.isPending || groupReplaceNodesMutation.isPending
        }
        resetKey={summaryEditingGroupId || ''}
        selectionMode={summaryEditingGroup?.policy === Policy.Fixed ? 'single' : 'multiple'}
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

          const deleteNodes = () =>
            nodeIDsToDelete.length
              ? groupDelNodesMutation.mutateAsync({
                  id: summaryEditingGroupId,
                  nodeIDs: nodeIDsToDelete,
                })
              : Promise.resolve()
          const addNodes = () =>
            nodeIDsToAdd.length
              ? groupAddNodesMutation.mutateAsync({
                  id: summaryEditingGroupId,
                  nodeIDs: nodeIDsToAdd,
                })
              : Promise.resolve()

          if (summaryEditingGroup.policy === Policy.Fixed) {
            await groupReplaceNodesMutation.mutateAsync({
              id: summaryEditingGroupId,
              nodeIDs,
              expectedVersion: summaryEditingGroup.version,
            })
          } else {
            await Promise.all([deleteNodes(), addNodes()])
          }
        }}
      />

      <GroupAddSubscriptionsModal
        opened={summaryGroupEditMode === 'subscriptions'}
        onClose={closeSummaryGroupEdit}
        groupName={summaryEditingGroupName}
        title={t('groupPicker.editSubscriptionsTitle', { name: summaryEditingGroupName })}
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
    </>
  )
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
