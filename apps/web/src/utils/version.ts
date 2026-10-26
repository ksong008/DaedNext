const releaseVersionPattern = /(?:^|\s)version=(\S+)/
const cargoVersionPattern = /^daed rust-native product ([^\s=]+)(?:\s|$)/
const coreRevisionPattern = /(?:^|\s)(?:core|dae-core)=(\S+)/

export function formatDaemonVersion(version?: string): string {
  const value = version?.trim()
  if (!value || value === 'unknown') return '—'

  const release = value.match(releaseVersionPattern)?.[1] ?? value.match(cargoVersionPattern)?.[1]
  const core = value.match(coreRevisionPattern)?.[1]

  if (release && core) return `${release} (${core})`
  return release ?? core ?? value
}
