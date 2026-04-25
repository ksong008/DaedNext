import type { ProtocolConfig } from './types'
import {
  generateAnytlsURL,
  generateHysteria2URL,
  generateURL,
  parseAnytlsUrl,
  parseHysteria2Url,
  parseJuicityUrl,
  parseSSRUrl,
  parseSSUrl,
  parseTrojanUrl,
  parseTuicUrl,
  parseV2rayUrl,
} from '@daeuniverse/dae-node-parser'
import { Base64 } from 'js-base64'
import { z } from 'zod'

import {
  anytlsSchema,
  DEFAULT_ANYTLS_FORM_VALUES,
  DEFAULT_HYSTERIA2_FORM_VALUES,
  DEFAULT_JUICITY_FORM_VALUES,
  DEFAULT_SS_FORM_VALUES,
  DEFAULT_SSR_FORM_VALUES,
  DEFAULT_TROJAN_FORM_VALUES,
  DEFAULT_TUIC_FORM_VALUES,
  DEFAULT_V2RAY_FORM_VALUES,
  hysteria2Schema,
  juicitySchema,
  ssrSchema,
  ssSchema,
  trojanSchema,
  tuicSchema,
  v2raySchema,
} from '~/constants'

import { AnyTLSForm } from '../AnyTLSForm'
import { Hysteria2Form } from '../Hysteria2Form'
import { JuicityForm } from '../JuicityForm'
import { SSForm } from '../SSForm'
import { SSRForm } from '../SSRForm'
import { TrojanForm } from '../TrojanForm'
import { TuicForm } from '../TuicForm'
import { V2rayForm } from '../V2rayForm'

// ============================================================================
// V2Ray Protocol (VMess/VLESS)
// ============================================================================

const v2rayFormSchema = v2raySchema.extend({
  protocol: z.enum(['vmess', 'vless']),
})

type V2rayFormValues = z.infer<typeof v2rayFormSchema>

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function parseJsonValue(raw: string): unknown | undefined {
  if (!raw.trim()) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function setOrDelete(target: Record<string, unknown>, key: string, value: unknown) {
  const shouldDelete =
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'number' && value === 0) ||
    (typeof value === 'boolean' && value === false)
  if (shouldDelete) {
    delete target[key]
    return
  }
  target[key] = value
}

function buildXhttpExtra(data: V2rayFormValues): string {
  const extra = parseJsonObject(data.xhttpExtra)

  setOrDelete(extra, 'xPaddingBytes', data.xPaddingBytes)
  setOrDelete(extra, 'xPaddingObfsMode', data.xPaddingObfsMode)
  setOrDelete(extra, 'xPaddingKey', data.xPaddingKey)
  setOrDelete(extra, 'xPaddingHeader', data.xPaddingHeader)
  setOrDelete(extra, 'xPaddingPlacement', data.xPaddingPlacement)
  setOrDelete(extra, 'xPaddingMethod', data.xPaddingMethod)
  setOrDelete(extra, 'noSSEHeader', data.noSSEHeader)
  setOrDelete(extra, 'scMaxEachPostBytes', data.scMaxEachPostBytes)
  setOrDelete(extra, 'scMinPostsIntervalMs', data.scMinPostsIntervalMs)
  setOrDelete(extra, 'scMaxBufferedPosts', data.scMaxBufferedPosts)
  setOrDelete(extra, 'uplinkHTTPMethod', data.uplinkHTTPMethod)
  setOrDelete(extra, 'sessionPlacement', data.sessionPlacement)
  setOrDelete(extra, 'sessionKey', data.sessionKey)
  setOrDelete(extra, 'seqPlacement', data.seqPlacement)
  setOrDelete(extra, 'seqKey', data.seqKey)
  setOrDelete(extra, 'uplinkDataPlacement', data.uplinkDataPlacement)
  setOrDelete(extra, 'uplinkDataKey', data.uplinkDataKey)
  setOrDelete(extra, 'uplinkChunkSize', data.uplinkChunkSize)

  const downloadSettings = parseJsonValue(data.downloadSettingsRaw)
  if (downloadSettings !== undefined) {
    extra.downloadSettings = downloadSettings
  } else if (!data.downloadSettingsRaw.trim()) {
    delete extra.downloadSettings
  }

  const xmux = parseJsonValue(data.xmuxRaw)
  if (xmux !== undefined) {
    extra.xmux = xmux
  } else if (!data.xmuxRaw.trim()) {
    delete extra.xmux
  }

  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : data.xhttpExtra
}

function generateV2rayLink(data: V2rayFormValues): string {
  const {
    protocol,
    net,
    tls,
    path,
    host,
    type,
    sni,
    flow,
    allowInsecure,
    alpn,
    ech,
    id,
    add,
    port,
    ps,
    pbk,
    fp,
    sid,
    spx,
    pqv,
    grpcMode,
    grpcAuthority,
    xhttpMode,
  } = data

  if (protocol === 'vless') {
    const params: Record<string, unknown> = {
      type: net,
      security: tls,
      host,
      headerType: type,
      sni,
      allowInsecure,
    }

    if (flow !== 'none') params.flow = flow

    // Path handling based on network type
    if (net === 'grpc') {
      params.serviceName = path
      if (grpcMode !== 'gun') params.mode = grpcMode
      if (grpcAuthority) params.authority = grpcAuthority
    } else if (net === 'kcp') {
      params.seed = path
    } else if (net === 'xhttp') {
      params.path = path
      if (xhttpMode) params.mode = xhttpMode
      const extra = buildXhttpExtra(data)
      if (extra) params.extra = extra
    } else {
      params.path = path
    }

    if (alpn !== '') params.alpn = alpn
    if (ech !== '') params.ech = ech
    if ((tls === 'tls' || tls === 'reality') && fp !== '') params.fp = fp

    // Reality-specific parameters
    if (tls === 'reality') {
      params.pbk = pbk
      if (sid) params.sid = sid
      if (spx) params.spx = spx
      if (pqv) params.pqv = pqv
    }

    return generateURL({
      protocol,
      username: id,
      host: add,
      port,
      hash: ps,
      params,
    })
  }

  if (protocol === 'vmess') {
    const body: Record<string, unknown> = structuredClone(data)

    switch (net) {
      case 'kcp':
      case 'tcp':
      default:
        body.type = ''
    }

    switch (body.net) {
      case 'ws':
      case 'httpupgrade':
      case 'xhttp':
        break
      case 'h2':
      case 'grpc':
      case 'kcp':
      default:
        if (body.net === 'tcp' && body.type === 'http') {
          break
        }
        body.path = ''
    }

    delete body.flow

    return `vmess://${Base64.encode(JSON.stringify(body))}`
  }

  return ''
}

export const v2rayProtocol: ProtocolConfig<V2rayFormValues> = {
  id: 'v2ray',
  label: 'V2RAY',
  schema: v2rayFormSchema,
  defaultValues: {
    protocol: 'vmess',
    ...DEFAULT_V2RAY_FORM_VALUES,
  },
  generateLink: generateV2rayLink,
  parseLink: parseV2rayUrl,
  FormComponent: V2rayForm,
}

// ============================================================================
// Shadowsocks Protocol
// ============================================================================

type SSFormValues = z.infer<typeof ssSchema>

function generateSSLink(data: SSFormValues): string {
  if (data.type === 'ss2022') {
    return generateURL({
      protocol: 'ss',
      username: data.method,
      password: data.password,
      host: data.server,
      port: data.port,
      hash: data.name,
    })
  }

  let link = `ss://${Base64.encode(`${data.method}:${data.password}`)}@${data.server}:${data.port}/`

  if (data.plugin) {
    const plugin: string[] = [data.plugin]

    if (data.plugin === 'v2ray-plugin') {
      if (data.tls) plugin.push('tls')
      if (data.mode !== 'websocket') plugin.push(`mode=${data.mode}`)
      if (data.host) plugin.push(`host=${data.host}`)

      let path = data.path
      if (path) {
        if (!path.startsWith('/')) path = `/${path}`
        plugin.push(`path=${path}`)
      }

      if (data.impl) plugin.push(`impl=${data.impl}`)
    } else {
      plugin.push(`obfs=${data.obfs}`)
      plugin.push(`obfs-host=${data.host}`)
      if (data.obfs === 'http') plugin.push(`obfs-path=${data.path}`)
      if (data.impl) plugin.push(`impl=${data.impl}`)
    }

    link += `?plugin=${encodeURIComponent(plugin.join(';'))}`
  }

  link += data.name.length ? `#${encodeURIComponent(data.name)}` : ''
  return link
}

export const ssProtocol: ProtocolConfig<SSFormValues> = {
  id: 'ss',
  label: 'SS',
  schema: ssSchema,
  defaultValues: DEFAULT_SS_FORM_VALUES,
  generateLink: generateSSLink,
  parseLink: parseSSUrl,
  FormComponent: SSForm,
}

// ============================================================================
// ShadowsocksR Protocol
// ============================================================================

type SSRFormValues = z.infer<typeof ssrSchema>

function generateSSRLink(data: SSRFormValues): string {
  return `ssr://${Base64.encode(
    `${data.server}:${data.port}:${data.proto}:${data.method}:${data.obfs}:${Base64.encodeURI(
      data.password,
    )}/?remarks=${Base64.encodeURI(data.name)}&protoparam=${Base64.encodeURI(
      data.protoParam,
    )}&obfsparam=${Base64.encodeURI(data.obfsParam)}`,
  )}`
}

export const ssrProtocol: ProtocolConfig<SSRFormValues> = {
  id: 'ssr',
  label: 'SSR',
  schema: ssrSchema,
  defaultValues: DEFAULT_SSR_FORM_VALUES,
  generateLink: generateSSRLink,
  parseLink: parseSSRUrl,
  FormComponent: SSRForm,
}

// ============================================================================
// Trojan Protocol
// ============================================================================

type TrojanFormValues = z.infer<typeof trojanSchema>

function generateTrojanLink(data: TrojanFormValues): string {
  const query: Record<string, unknown> = {
    allowInsecure: data.allowInsecure,
  }

  if (data.peer !== '') query.sni = data.peer

  let protocol = 'trojan'

  if (data.method !== 'origin' || data.obfs !== 'none') {
    protocol = 'trojan-go'
    query.type = data.obfs === 'none' ? 'original' : 'ws'

    if (data.method === 'shadowsocks') {
      query.encryption = `ss;${data.ssCipher};${data.ssPassword}`
    }

    if (query.type === 'ws') {
      query.host = data.host || ''
      query.path = data.path || '/'
    }

    delete query.allowInsecure
  }

  return generateURL({
    protocol,
    username: data.password,
    host: data.server,
    port: data.port,
    hash: data.name,
    params: query,
  })
}

export const trojanProtocol: ProtocolConfig<TrojanFormValues> = {
  id: 'trojan',
  label: 'Trojan',
  schema: trojanSchema,
  defaultValues: DEFAULT_TROJAN_FORM_VALUES,
  generateLink: generateTrojanLink,
  parseLink: parseTrojanUrl,
  FormComponent: TrojanForm,
}

// ============================================================================
// TUIC Protocol
// ============================================================================

type TuicFormValues = z.infer<typeof tuicSchema>

function generateTuicLink(data: TuicFormValues): string {
  const query = {
    congestion_control: data.congestion_control,
    alpn: data.alpn,
    sni: data.sni,
    allow_insecure: data.allowInsecure,
    disable_sni: data.disable_sni,
    udp_relay_mode: data.udp_relay_mode,
  }

  return generateURL({
    protocol: 'tuic',
    username: data.uuid,
    password: data.password,
    host: data.server,
    port: data.port,
    hash: data.name,
    params: query,
  })
}

export const tuicProtocol: ProtocolConfig<TuicFormValues> = {
  id: 'tuic',
  label: 'Tuic',
  schema: tuicSchema,
  defaultValues: DEFAULT_TUIC_FORM_VALUES,
  generateLink: generateTuicLink,
  parseLink: parseTuicUrl,
  FormComponent: TuicForm,
}

// ============================================================================
// Juicity Protocol
// ============================================================================

type JuicityFormValues = z.infer<typeof juicitySchema>

function generateJuicityLink(data: JuicityFormValues): string {
  const query = {
    congestion_control: data.congestion_control,
    pinned_certchain_sha256: data.pinned_certchain_sha256,
    sni: data.sni,
    allow_insecure: data.allowInsecure,
  }

  return generateURL({
    protocol: 'juicity',
    username: data.uuid,
    password: data.password,
    host: data.server,
    port: data.port,
    hash: data.name,
    params: query,
  })
}

export const juicityProtocol: ProtocolConfig<JuicityFormValues> = {
  id: 'juicity',
  label: 'Juicity',
  schema: juicitySchema,
  defaultValues: DEFAULT_JUICITY_FORM_VALUES,
  generateLink: generateJuicityLink,
  parseLink: parseJuicityUrl,
  FormComponent: JuicityForm,
}

// ============================================================================
// Hysteria2 Protocol
// ============================================================================

type Hysteria2FormValues = z.infer<typeof hysteria2Schema>

function generateHysteria2Link(data: Hysteria2FormValues): string {
  const query = {
    obfs: data.obfs,
    obfsPassword: data.obfsPassword,
    sni: data.sni,
    insecure: data.allowInsecure ? 1 : 0,
    pinSHA256: data.pinSHA256,
  }

  return generateHysteria2URL({
    protocol: 'hysteria2',
    auth: data.auth,
    host: data.server,
    port: data.port,
    params: query,
  })
}

export const hysteria2Protocol: ProtocolConfig<Hysteria2FormValues> = {
  id: 'hysteria2',
  label: 'Hysteria2',
  schema: hysteria2Schema,
  defaultValues: DEFAULT_HYSTERIA2_FORM_VALUES,
  generateLink: generateHysteria2Link,
  parseLink: parseHysteria2Url,
  FormComponent: Hysteria2Form,
}

// ============================================================================
// AnyTLS Protocol
// ============================================================================

type AnytlsFormValues = z.infer<typeof anytlsSchema>

export function generateAnytlsLink(data: AnytlsFormValues): string {
  const query = {
    sni: data.sni,
    insecure: data.allowInsecure ? 1 : 0,
  }

  return generateAnytlsURL({
    protocol: 'anytls',
    auth: data.auth,
    host: data.server,
    port: data.port,
    params: query,
  })
}

export const anytlsProtocol: ProtocolConfig<AnytlsFormValues> = {
  id: 'anytls',
  label: 'AnyTLS',
  schema: anytlsSchema,
  defaultValues: DEFAULT_ANYTLS_FORM_VALUES,
  generateLink: generateAnytlsLink,
  parseLink: parseAnytlsUrl,
  FormComponent: AnyTLSForm,
}
