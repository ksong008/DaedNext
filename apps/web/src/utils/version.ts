const coreRevisionPattern = /(?:^|\s)(?:core|dae-core)=(\S+)/
const productIdentityPattern = /^daed rust-native product(?:\s|$)/

export function formatDaemonVersion(version?: string): string {
  const value = version?.trim()
  if (!value || value === 'unknown') return '—'

  const core = value.match(coreRevisionPattern)?.[1]
  return core ?? (productIdentityPattern.test(value) ? '—' : value)
}
