import type { NodeLatencyJob } from '~/apis'

import { isNodeLatencyJobActive } from '~/apis/node_latency_job'

export type ManualLatencyProbeState = 'idle' | 'starting' | 'running' | 'cancelling'

export interface ManualLatencyProbeProgress {
  state: Exclude<ManualLatencyProbeState, 'idle'>
  completed: number
  total: number
  jobId: string | null
}

export class ManualLatencyTerminalTracker {
  private previousActiveJobId: string | null = null
  private refreshedTerminalJobId: string | null = null

  shouldRefresh(job: NodeLatencyJob | null | undefined) {
    if (job && isNodeLatencyJobActive(job)) {
      if (this.previousActiveJobId !== job.id && this.refreshedTerminalJobId === job.id) {
        this.refreshedTerminalJobId = null
      }
      this.previousActiveJobId = job.id
      return false
    }

    const terminalJobId = job?.id ?? this.previousActiveJobId
    this.previousActiveJobId = null
    if (!terminalJobId || this.refreshedTerminalJobId === terminalJobId) return false

    this.refreshedTerminalJobId = terminalJobId
    return true
  }
}

export function manualLatencyProgressFromJob(
  job: NodeLatencyJob | null | undefined,
  fallbackTotal: number,
): ManualLatencyProbeProgress | null {
  if (!job) return null
  const total = job.total > 0 ? job.total : fallbackTotal
  const completed = isNodeLatencyJobActive(job) ? job.completed : Math.max(job.completed, total)
  return {
    state: job.status === 'cancelling' ? 'cancelling' : 'running',
    completed: Math.min(completed, total),
    total,
    jobId: job.id,
  }
}
