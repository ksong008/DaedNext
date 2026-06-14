export type XhttpValidationPath = 'xhttpMode' | 'downloadSettingsRaw' | 'xmuxRaw' | 'alpn'

export interface XhttpValidationIssue {
  path: XhttpValidationPath
  message: string
}

export interface XhttpExtraInput {
  xhttpMode?: string
  downloadSettingsRaw?: string
  xmuxRaw?: string
}

export interface XhttpValidationInput extends XhttpExtraInput {
  tls?: string
  alpn?: string
}

type JsonObject = Record<string, unknown>
type Range = [number, number]

const SUPPORTED_XHTTP_MODES = new Set(['', 'auto', 'packet-up', 'stream-up', 'stream-one'])
const DOWNLOAD_SETTINGS_KEYS = [
  'address',
  'port',
  'network',
  'security',
  'tlsSettings',
  'xhttpSettings',
  'splithttpSettings',
]
const TLS_SETTINGS_KEYS = ['allowInsecure', 'serverName', 'alpn']
const DOWNLOAD_TRANSPORT_KEYS = ['host', 'path', 'mode', 'extra', 'xmux']
const NESTED_EXTRA_KEYS = ['xmux']
const XMUX_KEYS = ['maxConcurrency', 'maxConnections', 'cMaxReuseTimes', 'hMaxRequestTimes', 'hMaxReusableSecs']
const INTEGER_PATTERN = /^[+-]?\d+$/
const I32_MIN = -2147483648
const I32_MAX = 2147483647

function hasOwn(object: JsonObject, key: string): boolean {
  return Object.hasOwn(object, key)
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

function unsupportedFields(object: JsonObject, allowed: string[]): string[] {
  return Object.keys(object).filter((key) => !allowed.includes(key))
}

function unsupportedFieldsMessage(label: string, object: JsonObject, allowed: string[]): string | null {
  const fields = unsupportedFields(object, allowed)
  if (fields.length === 0) return null
  return `${label} contains unsupported fields: ${fields.join(', ')}`
}

function normalizeMode(mode: string | undefined): string {
  return (mode || '').trim().toLowerCase()
}

function isSupportedXhttpMode(mode: string): boolean {
  return SUPPORTED_XHTTP_MODES.has(normalizeMode(mode))
}

function parseI32String(raw: string, label: string): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!INTEGER_PATTERN.test(trimmed)) {
    return { ok: false, message: `${label} must be an integer` }
  }
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value) || value < I32_MIN || value > I32_MAX) {
    return { ok: false, message: `${label} is outside the supported i32 range` }
  }
  return { ok: true, value }
}

function parseI32Value(value: unknown, label: string): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < I32_MIN || value > I32_MAX) {
      return { ok: false, message: `${label} must be an i32 integer` }
    }
    return { ok: true, value }
  }
  if (typeof value === 'string') {
    return parseI32String(value, label)
  }
  return { ok: false, message: `${label} must be an integer` }
}

function parseRangeString(raw: string, label: string): { ok: true; value: Range } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: [0, 0] }

  const single = parseI32String(trimmed, label)
  if (single.ok) return { ok: true, value: [single.value, single.value] }

  const splitAt = trimmed.startsWith('-') ? trimmed.indexOf('-', 1) : trimmed.indexOf('-')
  if (splitAt < 0) {
    return { ok: false, message: `${label} must be an integer range` }
  }
  const from = parseI32String(trimmed.slice(0, splitAt), `${label}.from`)
  if (!from.ok) return from
  const to = parseI32String(trimmed.slice(splitAt + 1), `${label}.to`)
  if (!to.ok) return to
  return { ok: true, value: [from.value, to.value] }
}

function parseOptionalRange(
  value: unknown,
  label: string,
): { ok: true; value?: Range } | { ok: false; message: string } {
  if (value === undefined || value === null) {
    return { ok: true }
  }

  let range: Range
  if (typeof value === 'number') {
    const parsed = parseI32Value(value, label)
    if (!parsed.ok) return parsed
    range = [parsed.value, parsed.value]
  } else if (typeof value === 'string') {
    const parsed = parseRangeString(value, label)
    if (!parsed.ok) return parsed
    range = parsed.value
  } else if (isJsonObject(value)) {
    const unsupported = unsupportedFieldsMessage(label, value, ['from', 'to'])
    if (unsupported) return { ok: false, message: unsupported }
    const from =
      value.from === undefined || value.from === null
        ? { ok: true as const, value: 0 }
        : parseI32Value(value.from, `${label}.from`)
    if (!from.ok) return from
    const to =
      value.to === undefined || value.to === null
        ? { ok: true as const, value: 0 }
        : parseI32Value(value.to, `${label}.to`)
    if (!to.ok) return to
    range = [from.value, to.value]
  } else {
    return { ok: false, message: `${label} must be an integer, string range, or {from,to} object` }
  }

  return range[0] <= range[1] ? { ok: true, value: range } : { ok: true, value: [range[1], range[0]] }
}

function parsedRangeTo(range: ReturnType<typeof parseOptionalRange>): number {
  return range.ok ? range.value?.[1] || 0 : 0
}

function validateXmuxValue(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null
  if (!isJsonObject(value)) return `${label} must be a JSON object`

  const unsupported = unsupportedFieldsMessage(label, value, XMUX_KEYS)
  if (unsupported) return unsupported

  const ranges = {
    maxConcurrency: parseOptionalRange(value.maxConcurrency, `${label}.maxConcurrency`),
    maxConnections: parseOptionalRange(value.maxConnections, `${label}.maxConnections`),
    cMaxReuseTimes: parseOptionalRange(value.cMaxReuseTimes, `${label}.cMaxReuseTimes`),
    hMaxRequestTimes: parseOptionalRange(value.hMaxRequestTimes, `${label}.hMaxRequestTimes`),
    hMaxReusableSecs: parseOptionalRange(value.hMaxReusableSecs, `${label}.hMaxReusableSecs`),
  }

  for (const parsed of Object.values(ranges)) {
    if (!parsed.ok) return parsed.message
  }

  const maxConcurrencyTo = parsedRangeTo(ranges.maxConcurrency)
  const maxConnectionsTo = parsedRangeTo(ranges.maxConnections)
  if (maxConcurrencyTo > 0 && maxConnectionsTo > 0) {
    return `${label} cannot set maxConnections together with maxConcurrency`
  }

  return null
}

export function validateXhttpXmuxRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = parseJson(trimmed)
  if (!parsed.ok) return `XMUX JSON is invalid: ${parsed.message}`
  return validateXmuxValue(parsed.value, 'xmux')
}

function validateAlpnValue(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null
  let alpn: string[]
  if (typeof value === 'string') {
    alpn = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  } else if (Array.isArray(value)) {
    if (!value.every((item) => typeof item === 'string')) {
      return `${label} entries must be strings`
    }
    alpn = value.map((item) => item.trim()).filter(Boolean)
  } else {
    return `${label} must be a string or string array`
  }
  return validateSupportedAlpn(alpn, label, false)
}

function validateSupportedAlpn(alpn: string[], label: string, reality: boolean): string | null {
  const isHttp1 = alpn.length === 1 && alpn[0].toLowerCase() === 'http/1.1'
  const isH3 = alpn.length === 1 && alpn[0].toLowerCase() === 'h3'
  const supportsH2 = alpn.length === 0 || alpn.some((value) => value.toLowerCase() === 'h2')

  if (reality && isH3) {
    return `${label} does not support h3 with Reality`
  }
  if (reality && isHttp1) {
    return `${label} does not support single http/1.1 with Reality`
  }
  if (isHttp1 || isH3 || supportsH2) return null
  return `${label} must be empty, single http/1.1, h2-compatible, or single h3`
}

function validateTlsSettings(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (!isJsonObject(value)) return 'downloadSettings.tlsSettings must be a JSON object'

  const unsupported = unsupportedFieldsMessage('downloadSettings.tlsSettings', value, TLS_SETTINGS_KEYS)
  if (unsupported) return unsupported

  if (value.serverName !== undefined && value.serverName !== null && typeof value.serverName !== 'string') {
    return 'downloadSettings.tlsSettings.serverName must be a string'
  }
  if (value.allowInsecure !== undefined && value.allowInsecure !== null && typeof value.allowInsecure !== 'boolean') {
    return 'downloadSettings.tlsSettings.allowInsecure must be a boolean'
  }
  return validateAlpnValue(value.alpn, 'downloadSettings.tlsSettings.alpn')
}

function validateNestedExtra(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null

  let object: JsonObject
  if (typeof value === 'string') {
    if (!value.trim()) return null
    const parsed = parseJson(value)
    if (!parsed.ok) return `${label} JSON is invalid: ${parsed.message}`
    if (!isJsonObject(parsed.value)) return `${label} must be a JSON object`
    object = parsed.value
  } else if (isJsonObject(value)) {
    object = value
  } else {
    return `${label} must be a JSON object or JSON string`
  }

  const unsupported = unsupportedFieldsMessage(label, object, NESTED_EXTRA_KEYS)
  if (unsupported) return unsupported
  return validateXmuxValue(object.xmux, `${label}.xmux`)
}

function validateDownloadTransportSettings(settings: JsonObject, label: string): string | null {
  const unsupported = unsupportedFieldsMessage(label, settings, DOWNLOAD_TRANSPORT_KEYS)
  if (unsupported) return unsupported

  if (settings.host !== undefined && settings.host !== null && typeof settings.host !== 'string') {
    return `${label}.host must be a string`
  }
  if (settings.path !== undefined && settings.path !== null && typeof settings.path !== 'string') {
    return `${label}.path must be a string`
  }
  if (settings.mode !== undefined && settings.mode !== null) {
    if (typeof settings.mode !== 'string') return `${label}.mode must be a string`
    if (!isSupportedXhttpMode(settings.mode)) return `${label}.mode is not supported`
  }

  const directXmux = validateXmuxValue(settings.xmux, `${label}.xmux`)
  if (directXmux) return directXmux
  const nestedXmux = validateNestedExtra(settings.extra, `${label}.extra`)
  if (nestedXmux) return nestedXmux
  if (
    settings.xmux !== undefined &&
    settings.xmux !== null &&
    settings.extra !== undefined &&
    settings.extra !== null
  ) {
    const extra =
      typeof settings.extra === 'string' ? parseJson(settings.extra) : { ok: true as const, value: settings.extra }
    if (extra.ok && isJsonObject(extra.value) && extra.value.xmux !== undefined && extra.value.xmux !== null) {
      return `${label} cannot contain xmux in both xmux and extra.xmux`
    }
  }

  return null
}

export function validateXhttpDownloadSettingsRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parsed = parseJson(trimmed)
  if (!parsed.ok) return `DownloadSettings JSON is invalid: ${parsed.message}`
  if (!isJsonObject(parsed.value)) return 'DownloadSettings must be a JSON object'

  const value = parsed.value
  const unsupported = unsupportedFieldsMessage('downloadSettings', value, DOWNLOAD_SETTINGS_KEYS)
  if (unsupported) return unsupported

  if (typeof value.address !== 'string' || value.address.trim() === '') {
    return 'downloadSettings.address is required'
  }
  if (typeof value.port !== 'number' || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535) {
    return 'downloadSettings.port must be an integer in 1..=65535'
  }
  if (typeof value.network !== 'string' || !['xhttp', 'splithttp'].includes(value.network.trim().toLowerCase())) {
    return 'downloadSettings.network must be xhttp or splithttp'
  }
  if (typeof value.security !== 'string' || value.security.trim().toLowerCase() !== 'tls') {
    return 'downloadSettings.security must be tls'
  }

  const tlsSettings = validateTlsSettings(value.tlsSettings)
  if (tlsSettings) return tlsSettings

  const selectedKey = hasOwn(value, 'xhttpSettings') ? 'xhttpSettings' : 'splithttpSettings'
  const selected = value[selectedKey]
  if (!isJsonObject(selected)) {
    return `downloadSettings.${selectedKey} must be a JSON object`
  }
  return validateDownloadTransportSettings(selected, `downloadSettings.${selectedKey}`)
}

export function validateXhttpFormFields(data: XhttpValidationInput): XhttpValidationIssue[] {
  const issues: XhttpValidationIssue[] = []
  const mode = normalizeMode(data.xhttpMode)

  if (!isSupportedXhttpMode(mode)) {
    issues.push({ path: 'xhttpMode', message: 'XHTTP mode is not supported' })
  }
  if (mode !== 'stream-one') {
    const downloadSettings = validateXhttpDownloadSettingsRaw(data.downloadSettingsRaw || '')
    if (downloadSettings) issues.push({ path: 'downloadSettingsRaw', message: downloadSettings })
  }
  const xmux = validateXhttpXmuxRaw(data.xmuxRaw || '')
  if (xmux) issues.push({ path: 'xmuxRaw', message: xmux })

  const alpn = (data.alpn || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const alpnIssue = validateSupportedAlpn(alpn, 'ALPN', (data.tls || '').toLowerCase() === 'reality')
  if (alpnIssue) issues.push({ path: 'alpn', message: alpnIssue })

  return issues
}

export function buildSupportedXhttpExtra(data: XhttpExtraInput): string {
  const extra: JsonObject = {}
  const mode = normalizeMode(data.xhttpMode)

  if (mode !== 'stream-one') {
    const downloadRaw = data.downloadSettingsRaw?.trim() || ''
    if (downloadRaw && !validateXhttpDownloadSettingsRaw(downloadRaw)) {
      const parsed = parseJson(downloadRaw)
      if (parsed.ok && isJsonObject(parsed.value)) {
        extra.downloadSettings = parsed.value
      }
    }
  }

  const xmuxRaw = data.xmuxRaw?.trim() || ''
  if (xmuxRaw && !validateXhttpXmuxRaw(xmuxRaw)) {
    const parsed = parseJson(xmuxRaw)
    if (parsed.ok && (isJsonObject(parsed.value) || parsed.value === null)) {
      extra.xmux = parsed.value
    }
  }

  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : ''
}
