import { describe, expect, it } from 'vitest'
import { formatDaemonVersion } from './version'

describe('formatDaemonVersion', () => {
  it('shows only the core revision from the product identity', () => {
    expect(
      formatDaemonVersion(
        'daed rust-native product version=3.2.0-rb83 ui=fedcba654321 core=abcdef123456+dirty target=linux-x86_64-v3 features=native-ebpf,jemalloc',
      ),
    ).toBe('abcdef123456+dirty')
  })

  it('supports the identity emitted by direct Cargo builds', () => {
    expect(
      formatDaemonVersion(
        'daed rust-native product 0.1.0 dae-core=abcdef123456 profile=release target=x86_64-unknown-linux-gnu features=jemalloc',
      ),
    ).toBe('abcdef123456')
  })

  it('keeps plain versions and available partial identity fields', () => {
    expect(formatDaemonVersion(' v0.8.0 ')).toBe('v0.8.0')
    expect(formatDaemonVersion('daed rust-native product version=3.2.0-rb83')).toBe('—')
    expect(formatDaemonVersion('daed rust-native product core=abcdef123456')).toBe('abcdef123456')
  })

  it('uses a placeholder while the version is unavailable', () => {
    expect(formatDaemonVersion()).toBe('—')
    expect(formatDaemonVersion(' ')).toBe('—')
    expect(formatDaemonVersion('unknown')).toBe('—')
  })
})
