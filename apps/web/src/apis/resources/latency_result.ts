import type { NodeLatencyProbeResult } from '../types'

export interface NodeLatencyAPI {
  id: number
  latencyMs?: number | null
  alive: boolean
  testedAt: string
  message?: string | null
}

export function adaptNodeLatencyProbeResults(items: NodeLatencyAPI[]): NodeLatencyProbeResult[] {
  return items.map((item) => ({
    id: String(item.id),
    latencyMs: item.latencyMs ?? null,
    alive: item.alive,
    testedAt: item.testedAt,
    message: item.message ?? null,
  }))
}
