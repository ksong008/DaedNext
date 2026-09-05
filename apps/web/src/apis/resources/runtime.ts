import type { EventStreamSubscription } from '../event_stream'
import type { RuntimeOverviewAPI } from '../runtime_overview'
import type { TrafficOverviewQueryData } from '../types'
import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAPIClient } from '~/contexts'
import { isMockMode } from '~/mocks'
import { endpointURLAtom, tokenAtom } from '~/store'
import { normalizeEndpointURL } from '../client'
import { buildEventStreamURL, subscribeEventStream } from '../event_stream'
import { invalidateQueryKeys, webQueryKeys } from '../query_cache'
import { handleRuntimeGroupSelectionEvent } from '../runtime_event_cache'
import {
  acceptRuntimeOverview,
  adaptRuntimeOverview,
  createRuntimeOverviewCursor,
  mergeRuntimeOverviewDelta,
  runtimeOverviewHasDeltaBaseline,
} from '../runtime_overview'

export function trafficOverviewQueryKey(scope: string, windowSec: number, maxPoints: number) {
  return webQueryKeys.traffic.overview(scope, windowSec, maxPoints)
}

export function trafficCacheScope(endpointURL: string, token: string) {
  const input = `${normalizeEndpointURL(endpointURL)}\0${token}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `runtime-${(hash >>> 0).toString(16)}`
}

export function buildRuntimeEventsURL(endpointURL: string, windowSec: number, maxPoints: number) {
  return buildEventStreamURL(endpointURL, '/events/runtime', {
    windowSec,
    maxPoints,
  }).toString()
}

export function trafficOverviewRefetchInterval() {
  return 1_000
}

export function useTrafficOverviewQuery(windowSec: number, maxPoints: number) {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()
  const endpointURL = useStore(endpointURLAtom)
  const token = useStore(tokenAtom)
  const [isStreamLive, setIsStreamLive] = useState(false)
  const subscriptionRef = useRef<EventStreamSubscription | null>(null)
  const queryEnabled = isMockMode() || !!token
  const streamEnabled = !isMockMode() && !!token && typeof fetch !== 'undefined'
  const cacheScope = useMemo(() => trafficCacheScope(endpointURL, token), [endpointURL, token])
  const queryKey = useMemo(
    () => trafficOverviewQueryKey(cacheScope, windowSec, maxPoints),
    [cacheScope, maxPoints, windowSec],
  )
  const cursor = useMemo(
    () => ({
      lastFreshEventAt: { current: 0 },
      queryKey,
      overview: createRuntimeOverviewCursor(),
      freshEventStreak: { current: 0 },
      reconnectAttemptedAt: { current: null as number | null },
      groupSelectionGeneration: { current: null as string | null },
    }),
    [queryKey],
  )
  const streamURL = useMemo(
    () => (streamEnabled ? buildRuntimeEventsURL(endpointURL, windowSec, maxPoints) : null),
    [endpointURL, maxPoints, streamEnabled, windowSec],
  )

  const markFresh = useCallback(
    (payload: RuntimeOverviewAPI, promoteStream: boolean, source: 'snapshot' | 'delta' | 'rest') => {
      if (!acceptRuntimeOverview(cursor.overview, payload, source)) return false
      if (promoteStream) {
        cursor.lastFreshEventAt.current = Date.now()
        cursor.freshEventStreak.current = Math.min(cursor.freshEventStreak.current + 1, 3)
        if (cursor.freshEventStreak.current >= 2) setIsStreamLive(true)
        cursor.reconnectAttemptedAt.current = null
      }
      return true
    },
    [cursor],
  )

  useEffect(() => {
    if (!streamURL) {
      setIsStreamLive(false)
      cursor.reconnectAttemptedAt.current = null
      return
    }

    setIsStreamLive(false)
    cursor.lastFreshEventAt.current = Date.now()
    cursor.freshEventStreak.current = 0
    cursor.groupSelectionGeneration.current = null

    const handleOverview = (data: string) => {
      try {
        const payload = JSON.parse(data) as RuntimeOverviewAPI
        if (!markFresh(payload, true, 'snapshot')) return
        queryClient.setQueryData(queryKey, adaptRuntimeOverview(payload))
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleOverviewDelta = (data: string) => {
      try {
        const payload = JSON.parse(data) as RuntimeOverviewAPI
        const previous = queryClient.getQueryData<TrafficOverviewQueryData>(queryKey)
        if (!runtimeOverviewHasDeltaBaseline(previous, payload)) {
          setIsStreamLive(false)
          return
        }
        if (!markFresh(payload, true, 'delta')) return
        queryClient.setQueryData<TrafficOverviewQueryData>(queryKey, (previousData) =>
          mergeRuntimeOverviewDelta(previousData, payload, windowSec, maxPoints),
        )
      } catch {
        setIsStreamLive(false)
      }
    }
    const handleStreamError = () => {
      cursor.overview.needsStreamSnapshot = true
      setIsStreamLive(false)
      cursor.freshEventStreak.current = 0
    }

    const unsubscribe = subscribeEventStream({
      url: streamURL,
      token,
      onMessage(message) {
        if (message.event === 'runtime.overview') {
          handleOverview(message.data)
        } else if (message.event === 'runtime.overview.delta') {
          handleOverviewDelta(message.data)
        } else if (message.event === 'runtime.group-selection') {
          cursor.groupSelectionGeneration.current = handleRuntimeGroupSelectionEvent(
            queryClient,
            message.data,
            cursor.groupSelectionGeneration.current,
          )
        } else if (message.event === 'runtime.error') {
          handleStreamError()
        }
      },
      onError: handleStreamError,
    })

    subscriptionRef.current = unsubscribe
    return () => {
      if (subscriptionRef.current === unsubscribe) subscriptionRef.current = null
      unsubscribe()
    }
  }, [markFresh, maxPoints, queryClient, queryKey, cursor, streamURL, token, windowSec])

  useEffect(() => {
    const watchdog = window.setInterval(() => {
      if (!streamEnabled) return
      const age =
        cursor.lastFreshEventAt.current > 0 ? Date.now() - cursor.lastFreshEventAt.current : Number.POSITIVE_INFINITY
      if (age > 3_000) {
        cursor.freshEventStreak.current = 0
        setIsStreamLive(false)
      }
      if (age > 10_000 && cursor.reconnectAttemptedAt.current === null) {
        cursor.reconnectAttemptedAt.current = Date.now()
        cursor.lastFreshEventAt.current = Date.now()
        subscriptionRef.current?.restart()
      }
    }, 1_000)
    const refreshOnVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (isStreamLive) return
      void queryClient.refetchQueries({ queryKey })
      if (Date.now() - cursor.lastFreshEventAt.current > 3_000 && cursor.reconnectAttemptedAt.current === null) {
        cursor.reconnectAttemptedAt.current = Date.now()
        subscriptionRef.current?.restart()
      }
    }
    document.addEventListener('visibilitychange', refreshOnVisible)
    window.addEventListener('pageshow', refreshOnVisible)
    return () => {
      window.clearInterval(watchdog)
      document.removeEventListener('visibilitychange', refreshOnVisible)
      window.removeEventListener('pageshow', refreshOnVisible)
    }
  }, [isStreamLive, queryClient, queryKey, streamEnabled, cursor])

  useEffect(
    () => () => {
      queueMicrotask(() => {
        const query = queryClient.getQueryCache().find({ queryKey, exact: true })
        if (!query?.getObserversCount()) queryClient.removeQueries({ queryKey, exact: true })
      })
    },
    [queryClient, queryKey],
  )

  return useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<TrafficOverviewQueryData> => {
      const data = await apiClient.get<RuntimeOverviewAPI>('/runtime/overview', { windowSec, maxPoints }, { signal })
      signal.throwIfAborted()
      const adapted = adaptRuntimeOverview(data)
      if (markFresh(data, false, 'rest')) return adapted
      return queryClient.getQueryData<TrafficOverviewQueryData>(queryKey) ?? adapted
    },
    enabled: queryEnabled,
    placeholderData: (previousData, previousQuery) =>
      JSON.stringify(previousQuery?.queryKey) === JSON.stringify(queryKey) ? previousData : undefined,
    refetchInterval: () => (isStreamLive ? false : trafficOverviewRefetchInterval()),
    refetchIntervalInBackground: false,
  })
}

export function useReloadRuntimeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dry = false }: { dry?: boolean } = {}) => {
      const result = await apiClient.post<{ applied: number }>('/runtime/reload', { dry })
      return result.applied
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.general.state(), webQueryKeys.log.items()])
    },
  })
}

export function useStopRuntimeMutation() {
  const apiClient = useAPIClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.post<{ stopped: boolean }>('/runtime/stop', {})
      return result.stopped
    },
    onSuccess: () => {
      void invalidateQueryKeys(queryClient, [webQueryKeys.general.state(), webQueryKeys.log.items()])
    },
  })
}
