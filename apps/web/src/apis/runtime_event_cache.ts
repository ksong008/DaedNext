import type { QueryClient } from '@tanstack/react-query'
import { webQueryKeys } from './query_cache'

type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>

export function handleRuntimeGroupSelectionEvent(
  queryClient: QueryInvalidator,
  data: string,
  previousGeneration: string | null,
): string | null {
  const generation = parseRuntimeGroupSelectionGeneration(data)
  if (!generation || generation === previousGeneration) return previousGeneration

  void queryClient.invalidateQueries({ queryKey: webQueryKeys.group.summary() })
  return generation
}

function parseRuntimeGroupSelectionGeneration(data: string): string | null {
  try {
    const payload = JSON.parse(data) as { generation?: unknown }
    if (typeof payload.generation !== 'string') return null
    const generation = payload.generation.trim()
    return generation || null
  } catch {
    return null
  }
}
