export const PAGE_INSTANCE_HEADER = 'x-daed-page-id'

type RetireHandler = () => void

function createPageInstanceId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  globalThis.crypto?.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

const pageId = createPageInstanceId()
const pageAbort = new AbortController()
const retireHandlers = new Set<RetireHandler>()
let retired = false

export function pageInstanceId(): string {
  return pageId
}

export function pageLifecycleSignal(): AbortSignal {
  return pageAbort.signal
}

export function registerPageRetireHandler(handler: RetireHandler): () => void {
  if (retired) {
    handler()
    return () => {}
  }
  retireHandlers.add(handler)
  return () => retireHandlers.delete(handler)
}

export function retirePageOwners(reason: unknown = new Error('page retired')): void {
  if (retired) return
  retired = true
  pageAbort.abort(reason)
  for (const handler of retireHandlers) {
    try {
      handler()
    } catch (error) {
      console.error('Failed to retire page owner', error)
    }
  }
  retireHandlers.clear()
}
