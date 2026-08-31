/**
 * Suppress Monaco's internal "Canceled" errors when editor is disposed.
 * This is a known Monaco behavior when the editor is destroyed while operations are pending.
 *
 * This file should be imported as early as possible in the application.
 */

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason

    const isLspCancellation = reason?.code === -32800
    const isMonacoCancellation = reason?.name === 'Canceled' && reason?.message === 'Canceled'
    if (isLspCancellation || isMonacoCancellation) {
      event.preventDefault()
    }
  })
}
