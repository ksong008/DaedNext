import { memo } from 'react'
import { useTrafficOverviewQuery } from '~/apis'
import { REALTIME_TRAFFIC_MAX_POINTS, REALTIME_TRAFFIC_WINDOW_SECONDS, TrafficOverview } from './TrafficOverview'

export const TrafficOverviewIsland = memo(({
  nodeCount,
  subscriptionCount,
  minLatencyMs,
}: {
  nodeCount?: number
  subscriptionCount?: number
  minLatencyMs?: number
}) => {
  const { data: runtimeOverview } = useTrafficOverviewQuery(
    REALTIME_TRAFFIC_WINDOW_SECONDS,
    REALTIME_TRAFFIC_MAX_POINTS,
  )

  return (
    <TrafficOverview
      runtimeOverview={runtimeOverview}
      nodeCount={nodeCount}
      subscriptionCount={subscriptionCount}
      minLatencyMs={minLatencyMs}
    />
  )
})
