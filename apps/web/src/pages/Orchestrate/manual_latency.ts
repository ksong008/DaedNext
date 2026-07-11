import type { NodeLatencyJob } from '~/apis'

export interface ManualLatencyProbeProgress {
  completed: number
  total: number
  jobId: string | null
}

export function isLatencyJobActive(job?: NodeLatencyJob | null) {
  return job?.status === 'queued' || job?.status === 'running' || job?.status === 'cancelling'
}

export function manualLatencyProgressFromJob(
  job: NodeLatencyJob | null | undefined,
  fallbackTotal: number,
): ManualLatencyProbeProgress | null {
  if (!job) return null
  const total = job.total > 0 ? job.total : fallbackTotal
  const completed = isLatencyJobActive(job) ? job.completed : Math.max(job.completed, total)
  return {
    completed: Math.min(completed, total),
    total,
    jobId: job.id,
  }
}
