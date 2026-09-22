import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

function getSnapshot() {
  return document.visibilityState !== 'hidden'
}

export function usePageVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
