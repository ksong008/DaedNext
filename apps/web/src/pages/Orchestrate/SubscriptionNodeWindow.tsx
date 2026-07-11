import type { NodeLatencyProbeResult } from '~/apis'
import type { SubscriptionListView } from '~/apis/types'
import { Droppable } from '@hello-pangea/dnd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DraggableResourceBadge } from '~/components/DraggableResourceBadge'
import { Button } from '~/components/ui/button'
import { formatNodeLatencyCardLabel, getNodeLatencyCardTone } from '~/utils/node_display'
import {
  createSubscriptionNodeWindowKey,
  nextSubscriptionNodeWindowSize,
  SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE,
} from './subscription_node_window'

type SubscriptionNode = SubscriptionListView['subscriptions'][number]['nodes']['items'][number]

interface SubscriptionNodeWindowProps {
  subscriptionId: string
  revision: string
  nodes: SubscriptionNode[]
  nodeLatencies?: Record<string, NodeLatencyProbeResult>
}

export function SubscriptionNodeWindow(props: SubscriptionNodeWindowProps) {
  const windowKey = useMemo(
    () =>
      createSubscriptionNodeWindowKey(
        props.subscriptionId,
        props.revision,
        props.nodes.map((node) => node.id),
      ),
    [props.nodes, props.revision, props.subscriptionId],
  )

  return <ProgressiveSubscriptionNodeWindow key={windowKey} {...props} />
}

function ProgressiveSubscriptionNodeWindow({ subscriptionId, nodes, nodeLatencies }: SubscriptionNodeWindowProps) {
  const { t } = useTranslation()
  const [windowSize, setWindowSize] = useState(SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE)
  const visibleNodes = nodes.slice(0, windowSize)
  const nextWindowSize = nextSubscriptionNodeWindowSize(windowSize, nodes.length)
  const hasMore = visibleNodes.length < nodes.length

  return (
    <div className="space-y-2">
      <Droppable droppableId={`subscription-${subscriptionId}-nodes`} type="NODE" isDropDisabled>
        {(droppableProvided) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className="flex flex-wrap gap-2 pt-2"
          >
            {visibleNodes.map(({ id, name, protocol, transport }, nodeIndex) => {
              const latencyResult = nodeLatencies?.[id]

              return (
                <DraggableResourceBadge
                  key={id}
                  id={`subscription-node-${id}`}
                  index={nodeIndex}
                  name={name}
                  protocol={protocol}
                  transport={transport}
                  meta={latencyResult ? formatNodeLatencyCardLabel(latencyResult, 'N/A') : undefined}
                  metaTone={getNodeLatencyCardTone(latencyResult)}
                >
                  {name}
                </DraggableResourceBadge>
              )
            })}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWindowSize((current) => nextSubscriptionNodeWindowSize(current, nodes.length))}
          >
            {t('subscriptionNodeWindow.showMore', {
              count: nextWindowSize - visibleNodes.length,
              visible: visibleNodes.length,
              total: nodes.length,
            })}
          </Button>
        </div>
      )}
    </div>
  )
}
