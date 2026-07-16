import type { ManualLatencyProbeProgress } from './manual_latency'
import type { NodeLatencyJob, NodeLatencyJobView, NodeLatencyProbeResponse, NodeLatencyProbeResult } from '~/apis'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  isNodeLatencyJobActive,
  useCancelNodeLatencyJobMutation,
  useNodeLatencyJobQuery,
  useTestNodeLatenciesMutation,
} from '~/apis'
import { webQueryKeys } from '~/apis/query_cache'
import { manualLatencyProgressFromJob, ManualLatencyTerminalTracker } from './manual_latency'

const MANUAL_LATENCY_START_TIMEOUT_MS = 8_000
const MANUAL_LATENCY_JOB_REFETCH_INTERVAL_MS = 500

type ManualLatencyAdmissionState = 'idle' | 'starting' | 'running' | 'cancelling'

interface UseManualLatencyJobOptions {
  fallbackTotal: number
  onProbeResults: (results: NodeLatencyProbeResult[]) => void
  onTerminal: () => void
}

function admissionStateFromJob(job: NodeLatencyJob): ManualLatencyAdmissionState {
  return job.status === 'cancelling' ? 'cancelling' : 'running'
}

export function useManualLatencyJob({ fallbackTotal, onProbeResults, onTerminal }: UseManualLatencyJobOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const startMutation = useTestNodeLatenciesMutation()
  const cancelMutation = useCancelNodeLatencyJobMutation()
  const { data: jobData, refetch: refetchJob } = useNodeLatencyJobQuery(MANUAL_LATENCY_JOB_REFETCH_INTERVAL_MS, true)
  const [pendingProgress, setPendingProgress] = useState<ManualLatencyProbeProgress | null>(null)
  const admissionStateRef = useRef<ManualLatencyAdmissionState>('idle')
  const startAbortRef = useRef<AbortController | null>(null)
  const startRequestRef = useRef<Promise<NodeLatencyProbeResponse> | null>(null)
  const cancellationRequestedRef = useRef(false)
  const terminalTrackerRef = useRef(new ManualLatencyTerminalTracker())

  const getCachedJob = useCallback(
    () => queryClient.getQueryData<NodeLatencyJobView>(webQueryKeys.node.latencyJob())?.job ?? null,
    [queryClient],
  )

  const refetchCanonicalJob = useCallback(async () => {
    const result = await refetchJob({ throwOnError: true })
    return result.data?.job ?? null
  }, [refetchJob])

  const canonicalJob = jobData?.job ?? null
  const canonicalProgress = useMemo(
    () => (isNodeLatencyJobActive(canonicalJob) ? manualLatencyProgressFromJob(canonicalJob, fallbackTotal) : null),
    [canonicalJob, fallbackTotal],
  )
  const progress = useMemo(() => {
    if (!canonicalProgress) return pendingProgress
    if (
      pendingProgress?.state === 'cancelling' &&
      (!pendingProgress.jobId || pendingProgress.jobId === canonicalProgress.jobId)
    ) {
      return { ...canonicalProgress, state: 'cancelling' as const }
    }
    return canonicalProgress
  }, [canonicalProgress, pendingProgress])

  useEffect(() => {
    if (jobData === undefined) return

    const job = jobData.job
    const shouldRefreshDependentViews = terminalTrackerRef.current.shouldRefresh(job)
    if (job && isNodeLatencyJobActive(job)) {
      admissionStateRef.current = admissionStateFromJob(job)
      return
    }

    admissionStateRef.current = 'idle'
    if (shouldRefreshDependentViews) onTerminal()
  }, [jobData, onTerminal])

  const start = useCallback(async () => {
    const cachedJob = getCachedJob()
    if (admissionStateRef.current !== 'idle' || isNodeLatencyJobActive(cachedJob) || fallbackTotal <= 0) {
      return
    }

    const previousJobId = cachedJob?.id ?? null
    const startAbort = new AbortController()
    admissionStateRef.current = 'starting'
    cancellationRequestedRef.current = false
    startAbortRef.current = startAbort
    setPendingProgress({
      state: 'starting',
      completed: 0,
      total: fallbackTotal,
      jobId: null,
    })

    try {
      const request = startMutation.mutateAsync({
        signal: startAbort.signal,
        timeoutMs: MANUAL_LATENCY_START_TIMEOUT_MS,
      })
      startRequestRef.current = request
      const response = await request
      if (response.items.length > 0) {
        onProbeResults(response.items)
      }

      try {
        await refetchCanonicalJob()
      } catch (error) {
        console.error('Failed to confirm admitted node latency job', error)
      }
    } catch (error) {
      if (cancellationRequestedRef.current) return

      let recoveredJob: NodeLatencyJob | null = null
      try {
        recoveredJob = await refetchCanonicalJob()
      } catch (recoveryError) {
        console.error('Failed to recover node latency job ownership', recoveryError)
      }
      if (isNodeLatencyJobActive(recoveredJob) || (recoveredJob && recoveredJob.id !== previousJobId)) return

      toast.error(error instanceof Error ? error.message : t('error'))
    } finally {
      if (startAbortRef.current === startAbort) {
        startAbortRef.current = null
      }
      startRequestRef.current = null
      setPendingProgress((current) => (current?.state === 'starting' ? null : current))
      if (!cancellationRequestedRef.current && admissionStateRef.current === 'starting') {
        const currentJob = getCachedJob()
        admissionStateRef.current =
          currentJob && isNodeLatencyJobActive(currentJob) ? admissionStateFromJob(currentJob) : 'idle'
      }
    }
  }, [fallbackTotal, getCachedJob, onProbeResults, refetchCanonicalJob, startMutation, t])

  const cancel = useCallback(async () => {
    const cachedJob = getCachedJob()
    if (admissionStateRef.current === 'idle' && !isNodeLatencyJobActive(cachedJob) && !startRequestRef.current) {
      return
    }

    cancellationRequestedRef.current = true
    admissionStateRef.current = 'cancelling'
    setPendingProgress({
      state: 'cancelling',
      completed: progress?.completed ?? 0,
      total: progress?.total ?? fallbackTotal,
      jobId: progress?.jobId ?? cachedJob?.id ?? null,
    })
    startAbortRef.current?.abort(new Error('manual latency probe start cancelled'))

    try {
      await startRequestRef.current?.catch(() => undefined)
      let job = getCachedJob()
      if (!job || !isNodeLatencyJobActive(job)) {
        job = await refetchCanonicalJob()
      }
      if (!job || !isNodeLatencyJobActive(job)) return

      await cancelMutation.mutateAsync(job.id)
      try {
        await refetchCanonicalJob()
      } catch (error) {
        console.error('Failed to confirm cancelled node latency job', error)
      }
    } catch (error) {
      let recoveredJob = getCachedJob()
      try {
        recoveredJob = await refetchCanonicalJob()
      } catch (recoveryError) {
        console.error('Failed to recover node latency job after cancellation', recoveryError)
      }
      if (isNodeLatencyJobActive(recoveredJob)) {
        toast.error(error instanceof Error ? error.message : t('error'))
      }
    } finally {
      cancellationRequestedRef.current = false
      setPendingProgress(null)
      const currentJob = getCachedJob()
      admissionStateRef.current =
        currentJob && isNodeLatencyJobActive(currentJob) ? admissionStateFromJob(currentJob) : 'idle'
    }
  }, [cancelMutation, fallbackTotal, getCachedJob, progress, refetchCanonicalJob, t])

  return {
    cancel,
    cancelling: cancelMutation.isPending || pendingProgress?.state === 'cancelling',
    progress,
    start,
  }
}
