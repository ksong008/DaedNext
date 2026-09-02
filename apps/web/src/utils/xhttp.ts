import { validateEchConfigListBase64 } from './ech'
export type XhttpValidationPath = 'xhttpMode' | 'xhttpExtra' | 'downloadSettingsRaw' | 'xmuxRaw' | 'alpn'

export interface XhttpValidationIssue {
  path: XhttpValidationPath
  message: string
}

export interface XhttpExtraInput {
  xhttpMode?: string
  xhttpExtra?: string
  xPaddingBytes?: string
  xPaddingObfsMode?: boolean
  xPaddingKey?: string
  xPaddingHeader?: string
  xPaddingPlacement?: string
  xPaddingMethod?: string
  noSSEHeader?: boolean
  scMaxEachPostBytes?: string
  scMinPostsIntervalMs?: string
  scMaxBufferedPosts?: number
  uplinkHTTPMethod?: string
  sessionPlacement?: string
  sessionKey?: string
  seqPlacement?: string
  seqKey?: string
  uplinkDataPlacement?: string
  uplinkDataKey?: string
  uplinkChunkSize?: string
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
  'realitySettings',
  'xhttpSettings',
  'splithttpSettings',
]
const XHTTP_SETTINGS_KEYS = [
  'host',
  'path',
  'mode',
  'headers',
  'xPaddingBytes',
  'xPaddingObfsMode',
  'xPaddingKey',
  'xPaddingHeader',
  'xPaddingPlacement',
  'xPaddingMethod',
  'uplinkHTTPMethod',
  'sessionIDPlacement',
  'sessionIDKey',
  'sessionIDTable',
  'sessionIDLength',
  'seqPlacement',
  'seqKey',
  'uplinkDataPlacement',
  'uplinkDataKey',
  'uplinkChunkSize',
  'noGRPCHeader',
  'noSSEHeader',
  'scMaxEachPostBytes',
  'scMinPostsIntervalMs',
  'scMaxBufferedPosts',
  'scStreamUpServerSecs',
  'serverMaxHeaderBytes',
  'xmux',
  'downloadSettings',
  'extra',
]
const TLS_SETTINGS_KEYS = ['allowInsecure', 'serverName', 'alpn', 'fingerprint', 'echConfigList']
const REALITY_SETTINGS_KEYS = [
  'allowInsecure',
  'serverName',
  'alpn',
  'fingerprint',
  'publicKey',
  'shortId',
  'spiderX',
  'mldsa65Verify',
]
const DOWNLOAD_TRANSPORT_KEYS = XHTTP_SETTINGS_KEYS
const XMUX_KEYS = [
  'maxConcurrency',
  'maxConnections',
  'cMaxReuseTimes',
  'hMaxRequestTimes',
  'hMaxReusableSecs',
  'hKeepAlivePeriod',
]
const XHTTP_RANGE_KEYS = [
  'xPaddingBytes',
  'sessionIDLength',
  'uplinkChunkSize',
  'scMaxEachPostBytes',
  'scMinPostsIntervalMs',
  'scStreamUpServerSecs',
]
const XHTTP_STRING_KEYS = [
  'host',
  'path',
  'xPaddingKey',
  'xPaddingHeader',
  'sessionIDKey',
  'sessionIDTable',
  'seqKey',
  'uplinkDataKey',
]
const XHTTP_BOOL_KEYS = ['xPaddingObfsMode', 'noGRPCHeader', 'noSSEHeader']
const PADDING_PLACEMENTS = new Set(['', 'queryInHeader', 'cookie', 'header', 'query'])
const PADDING_METHODS = new Set(['', 'repeat-x', 'tokenish'])
const META_PLACEMENTS = new Set(['', 'path', 'cookie', 'header', 'query'])
const UPLINK_DATA_PLACEMENTS = new Set(['', 'auto', 'body', 'cookie', 'header'])
const INVALID_HEADER_NAME_PATTERN = /[\r\n:]/
const INVALID_HEADER_VALUE_PATTERN = /[\r\n]/
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

function validateOptionalInteger(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? null : `${label} must be an integer`
  }
  if (typeof value === 'string') {
    return INTEGER_PATTERN.test(value.trim()) ? null : `${label} must be an integer`
  }
  return `${label} must be an integer`
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

  const hKeepAlivePeriod = validateOptionalInteger(value.hKeepAlivePeriod, `${label}.hKeepAlivePeriod`)
  if (hKeepAlivePeriod) return hKeepAlivePeriod

  return null
}

export function validateXhttpXmuxRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = parseJson(trimmed)
  if (!parsed.ok) return `XMUX JSON is invalid: ${parsed.message}`
  return validateXmuxValue(parsed.value, 'xmux')
}

function validateAlpnValue(value: unknown, label: string, reality = false): string | null {
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
  return validateSupportedAlpn(alpn, label, reality)
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
  if (value.fingerprint !== undefined && value.fingerprint !== null && typeof value.fingerprint !== 'string') {
    return 'downloadSettings.tlsSettings.fingerprint must be a string'
  }
  if (value.allowInsecure !== undefined && value.allowInsecure !== null && typeof value.allowInsecure !== 'boolean') {
    return 'downloadSettings.tlsSettings.allowInsecure must be a boolean'
  }
  const ech = validateEchConfigListBase64(value.echConfigList, 'downloadSettings.tlsSettings.echConfigList')
  if (ech) return ech
  return validateAlpnValue(value.alpn, 'downloadSettings.tlsSettings.alpn')
}

function validateRealitySettings(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (!isJsonObject(value)) return 'downloadSettings.realitySettings must be a JSON object'

  const unsupported = unsupportedFieldsMessage('downloadSettings.realitySettings', value, REALITY_SETTINGS_KEYS)
  if (unsupported) return unsupported

  for (const key of ['serverName', 'fingerprint', 'publicKey', 'shortId', 'spiderX', 'mldsa65Verify']) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') {
      return `downloadSettings.realitySettings.${key} must be a string`
    }
  }
  if (value.allowInsecure !== undefined && value.allowInsecure !== null && typeof value.allowInsecure !== 'boolean') {
    return 'downloadSettings.realitySettings.allowInsecure must be a boolean'
  }
  return validateAlpnValue(value.alpn, 'downloadSettings.realitySettings.alpn', true)
}

function parseSettingsExtra(value: unknown, label: string): JsonObject | string | null {
  if (value === undefined || value === null) return null

  if (typeof value === 'string') {
    if (!value.trim()) return null
    const parsed = parseJson(value)
    if (!parsed.ok) return `${label} JSON is invalid: ${parsed.message}`
    if (!isJsonObject(parsed.value)) return `${label} must be a JSON object`
    return parsed.value
  }
  if (isJsonObject(value)) return value
  return `${label} must be a JSON object or JSON string`
}

function validateStringFields(object: JsonObject, fields: string[], label: string): string | null {
  for (const field of fields) {
    if (object[field] !== undefined && object[field] !== null && typeof object[field] !== 'string') {
      return `${label}.${field} must be a string`
    }
  }
  return null
}

function validateBoolFields(object: JsonObject, fields: string[], label: string): string | null {
  for (const field of fields) {
    if (object[field] !== undefined && object[field] !== null && typeof object[field] !== 'boolean') {
      return `${label}.${field} must be a boolean`
    }
  }
  return null
}

function validateHeadersValue(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null
  if (!isJsonObject(value)) return `${label}.headers must be a JSON object`

  for (const [name, headerValue] of Object.entries(value)) {
    if (name.toLowerCase() === 'host') return `${label}.headers cannot contain host`
    if (name.trim() === '' || INVALID_HEADER_NAME_PATTERN.test(name)) {
      return `${label}.headers contains an invalid header name`
    }
    if (typeof headerValue !== 'string') return `${label}.headers.${name} must be a string`
    if (INVALID_HEADER_VALUE_PATTERN.test(headerValue)) return `${label}.headers.${name} contains invalid line breaks`
  }
  return null
}

function validatePlacement(value: unknown, label: string, allowed: Set<string>): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return `${label} must be a string`
  return allowed.has(value) ? null : `${label} is not supported`
}

function validateXhttpSettingsObject(
  object: JsonObject,
  label: string,
  options: { validateDownloadSettings: boolean },
): string | null {
  const unsupported = unsupportedFieldsMessage(label, object, XHTTP_SETTINGS_KEYS)
  if (unsupported) return unsupported

  const strings = validateStringFields(object, XHTTP_STRING_KEYS, label)
  if (strings) return strings

  const bools = validateBoolFields(object, XHTTP_BOOL_KEYS, label)
  if (bools) return bools

  const headers = validateHeadersValue(object.headers, label)
  if (headers) return headers

  if (object.mode !== undefined && object.mode !== null) {
    if (typeof object.mode !== 'string') return `${label}.mode must be a string`
    if (!isSupportedXhttpMode(object.mode)) return `${label}.mode is not supported`
  }

  const xPaddingPlacement = validatePlacement(
    object.xPaddingPlacement,
    `${label}.xPaddingPlacement`,
    PADDING_PLACEMENTS,
  )
  if (xPaddingPlacement) return xPaddingPlacement

  const xPaddingMethod = validatePlacement(object.xPaddingMethod, `${label}.xPaddingMethod`, PADDING_METHODS)
  if (xPaddingMethod) return xPaddingMethod

  for (const key of ['sessionIDPlacement', 'seqPlacement']) {
    const placement = validatePlacement(object[key], `${label}.${key}`, META_PLACEMENTS)
    if (placement) return placement
  }

  const uplinkDataPlacement = validatePlacement(
    object.uplinkDataPlacement,
    `${label}.uplinkDataPlacement`,
    UPLINK_DATA_PLACEMENTS,
  )
  if (uplinkDataPlacement) return uplinkDataPlacement

  if (object.uplinkHTTPMethod !== undefined && object.uplinkHTTPMethod !== null) {
    if (typeof object.uplinkHTTPMethod !== 'string') return `${label}.uplinkHTTPMethod must be a string`
    const method = object.uplinkHTTPMethod.trim().toUpperCase()
    if (method !== 'GET' && method !== 'POST') return `${label}.uplinkHTTPMethod must be GET or POST`
  }

  for (const key of XHTTP_RANGE_KEYS) {
    const parsed = parseOptionalRange(object[key], `${label}.${key}`)
    if (!parsed.ok) return parsed.message
    if (key === 'xPaddingBytes' && parsed.value && (parsed.value[0] || parsed.value[1])) {
      if (parsed.value[0] <= 0 || parsed.value[1] <= 0) {
        return `${label}.xPaddingBytes cannot be disabled`
      }
    }
  }

  const scMaxBufferedPosts = validateOptionalInteger(object.scMaxBufferedPosts, `${label}.scMaxBufferedPosts`)
  if (scMaxBufferedPosts) return scMaxBufferedPosts

  if (object.serverMaxHeaderBytes !== undefined && object.serverMaxHeaderBytes !== null) {
    const parsed = parseI32Value(object.serverMaxHeaderBytes, `${label}.serverMaxHeaderBytes`)
    if (!parsed.ok) return parsed.message
    if (parsed.value < 0) return `${label}.serverMaxHeaderBytes rejects negative values`
  }

  const xmux = validateXmuxValue(object.xmux, `${label}.xmux`)
  if (xmux) return xmux

  if (options.validateDownloadSettings) {
    const downloadSettings = validateXhttpDownloadSettingsValue(object.downloadSettings, `${label}.downloadSettings`)
    if (downloadSettings) return downloadSettings
  }

  const extra = parseSettingsExtra(object.extra, `${label}.extra`)
  if (typeof extra === 'string') return extra
  if (extra) return validateXhttpSettingsObject(extra, `${label}.extra`, options)

  return null
}

function validateDownloadTransportSettings(settings: JsonObject, label: string): string | null {
  const unsupported = unsupportedFieldsMessage(label, settings, DOWNLOAD_TRANSPORT_KEYS)
  if (unsupported) return unsupported
  return validateXhttpSettingsObject(settings, label, { validateDownloadSettings: false })
}

function validateXhttpDownloadSettingsValue(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null
  if (!isJsonObject(value)) return `${label} must be a JSON object`

  const unsupported = unsupportedFieldsMessage(label, value, DOWNLOAD_SETTINGS_KEYS)
  if (unsupported) return unsupported

  if (typeof value.address !== 'string' || value.address.trim() === '') {
    return `${label}.address is required`
  }
  if (typeof value.port !== 'number' || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535) {
    return `${label}.port must be an integer in 1..=65535`
  }
  if (typeof value.network !== 'string' || !['xhttp', 'splithttp'].includes(value.network.trim().toLowerCase())) {
    return `${label}.network must be xhttp or splithttp`
  }
  if (typeof value.security !== 'string') return `${label}.security must be tls or reality`
  const security = value.security.trim().toLowerCase()
  if (security !== 'tls' && security !== 'reality') return `${label}.security must be tls or reality`

  const tlsSettings = validateTlsSettings(value.tlsSettings)
  if (tlsSettings) return tlsSettings
  const realitySettings = validateRealitySettings(value.realitySettings)
  if (realitySettings) return realitySettings

  const selectedKey = hasOwn(value, 'xhttpSettings') ? 'xhttpSettings' : 'splithttpSettings'
  const selected = value[selectedKey]
  if (!isJsonObject(selected)) {
    return `${label}.${selectedKey} must be a JSON object`
  }
  return validateDownloadTransportSettings(selected, `${label}.${selectedKey}`)
}

export function validateXhttpDownloadSettingsRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parsed = parseJson(trimmed)
  if (!parsed.ok) return `DownloadSettings JSON is invalid: ${parsed.message}`
  if (!isJsonObject(parsed.value)) return 'DownloadSettings must be a JSON object'

  return validateXhttpDownloadSettingsValue(parsed.value, 'downloadSettings')
}

export function validateXhttpExtraRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parsed = parseJson(trimmed)
  if (!parsed.ok) return `XHTTP Extra JSON is invalid: ${parsed.message}`
  if (!isJsonObject(parsed.value)) return 'XHTTP Extra must be a JSON object'
  return validateXhttpSettingsObject(parsed.value, 'XHTTP Extra', { validateDownloadSettings: true })
}

export function validateXhttpFormFields(data: XhttpValidationInput): XhttpValidationIssue[] {
  const issues: XhttpValidationIssue[] = []
  const mode = normalizeMode(data.xhttpMode)

  if (!isSupportedXhttpMode(mode)) {
    issues.push({ path: 'xhttpMode', message: 'XHTTP mode is not supported' })
  }
  const xhttpExtra = validateXhttpExtraRaw(data.xhttpExtra || '')
  if (xhttpExtra) issues.push({ path: 'xhttpExtra', message: xhttpExtra })
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

function assignString(object: JsonObject, key: string, value: string | undefined): void {
  const trimmed = value?.trim() || ''
  if (trimmed) object[key] = trimmed
}

function buildStructuredXhttpSettings(data: XhttpExtraInput): JsonObject {
  const extra: JsonObject = {}

  assignString(extra, 'xPaddingBytes', data.xPaddingBytes)
  if (data.xPaddingObfsMode) extra.xPaddingObfsMode = true
  assignString(extra, 'xPaddingKey', data.xPaddingKey)
  assignString(extra, 'xPaddingHeader', data.xPaddingHeader)
  assignString(extra, 'xPaddingPlacement', data.xPaddingPlacement)
  assignString(extra, 'xPaddingMethod', data.xPaddingMethod)
  if (data.noSSEHeader) extra.noSSEHeader = true
  assignString(extra, 'scMaxEachPostBytes', data.scMaxEachPostBytes)
  assignString(extra, 'scMinPostsIntervalMs', data.scMinPostsIntervalMs)
  if (typeof data.scMaxBufferedPosts === 'number' && data.scMaxBufferedPosts > 0) {
    extra.scMaxBufferedPosts = data.scMaxBufferedPosts
  }
  assignString(extra, 'uplinkHTTPMethod', data.uplinkHTTPMethod)
  assignString(extra, 'sessionIDPlacement', data.sessionPlacement)
  assignString(extra, 'sessionIDKey', data.sessionKey)
  assignString(extra, 'seqPlacement', data.seqPlacement)
  assignString(extra, 'seqKey', data.seqKey)
  assignString(extra, 'uplinkDataPlacement', data.uplinkDataPlacement)
  assignString(extra, 'uplinkDataKey', data.uplinkDataKey)
  assignString(extra, 'uplinkChunkSize', data.uplinkChunkSize)

  return extra
}

export function buildSupportedXhttpExtra(data: XhttpExtraInput): string {
  const extra: JsonObject = {}
  const mode = normalizeMode(data.xhttpMode)

  const rawExtra = data.xhttpExtra?.trim() || ''
  if (rawExtra) {
    const parsed = parseJson(rawExtra)
    if (parsed.ok && isJsonObject(parsed.value)) {
      if (!validateXhttpExtraRaw(rawExtra)) {
        Object.assign(extra, parsed.value)
      } else {
        for (const [key, value] of Object.entries(parsed.value)) {
          if (!XHTTP_SETTINGS_KEYS.includes(key)) extra[key] = value
        }
      }
    }
  }

  Object.assign(extra, buildStructuredXhttpSettings(data))

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
