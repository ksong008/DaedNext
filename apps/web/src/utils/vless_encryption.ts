export const VLESS_ENCRYPTION_SUITE = 'mlkem768x25519plus' as const

export type VlessEncryptionMode = 'native' | 'xorpub' | 'random'
export type VlessEncryptionRtt = '1rtt' | '0rtt'

export interface VlessEncryptionAccount {
  enabled: boolean
  mode: VlessEncryptionMode
  rtt: VlessEncryptionRtt
  fields: string
}

const DEFAULT_ACCOUNT: VlessEncryptionAccount = {
  enabled: false,
  mode: 'native',
  rtt: '1rtt',
  fields: '',
}

function isMode(value: string | undefined): value is VlessEncryptionMode {
  return value === 'native' || value === 'xorpub' || value === 'random'
}

function isRtt(value: string | undefined): value is VlessEncryptionRtt {
  return value === '1rtt' || value === '0rtt'
}

export function supportsVlessEncryptionNetwork(network: string): boolean {
  return ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'].includes(network)
}

export function hasVlessEncryptionAccountPrefix(value: string): boolean {
  const parts = value.trim().split('.')
  return parts[0] === VLESS_ENCRYPTION_SUITE && isMode(parts[1]) && isRtt(parts[2]) && parts.length >= 4
}

export function parseVlessEncryptionAccount(value?: string): VlessEncryptionAccount {
  const raw = value?.trim() ?? ''
  if (raw === '' || raw === 'none') return { ...DEFAULT_ACCOUNT }

  const parts = raw.split('.')
  const hasSupportedSuite = parts[0] === VLESS_ENCRYPTION_SUITE

  return {
    enabled: true,
    mode: hasSupportedSuite && isMode(parts[1]) ? parts[1] : DEFAULT_ACCOUNT.mode,
    rtt: hasSupportedSuite && isRtt(parts[2]) ? parts[2] : DEFAULT_ACCOUNT.rtt,
    fields: hasSupportedSuite ? parts.slice(3).join('.') : raw,
  }
}

export function buildVlessEncryptionAccount(account: VlessEncryptionAccount): string {
  if (!account.enabled) return 'none'

  const prefix = `${VLESS_ENCRYPTION_SUITE}.${account.mode}.${account.rtt}`
  const fields = account.fields.trim()
  return fields === '' ? prefix : `${prefix}.${fields}`
}
