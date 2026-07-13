import type { z } from 'zod'
import type { ProtocolConfig } from './types'
import {
  generateAnytlsURL,
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
  v2rayProtocolSchema,
} from '~/constants'
import { AnyTLSForm } from '../AnyTLSForm'

import { Hysteria2Form } from '../Hysteria2Form'
import { JuicityForm } from '../JuicityForm'
import { SSForm } from '../SSForm'
import { SSRForm } from '../SSRForm'
import { TrojanForm } from '../TrojanForm'
import { TuicForm } from '../TuicForm'
import { V2rayForm } from '../V2rayForm'
import { generateHysteria2Link, generateV2rayLink } from './generators'

// ============================================================================
// V2Ray Protocol (VMess/VLESS)
// ============================================================================

const v2rayFormSchema = v2rayProtocolSchema

type V2rayFormValues = z.infer<typeof v2rayFormSchema>

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
  const plugin = buildSSPlugin(data)

  if (data.type === 'ss2022') {
    return generateURL({
      protocol: 'ss',
      username: data.method,
      password: data.password,
      host: data.server,
      port: data.port,
      hash: data.name,
      params: plugin ? { plugin } : undefined,
    })
  }

  let link = `ss://${Base64.encode(`${data.method}:${data.password}`)}@${data.server}:${data.port}/`

  if (plugin) link += `?plugin=${encodeURIComponent(plugin)}`

  link += data.name.length ? `#${encodeURIComponent(data.name)}` : ''
  return link
}

function buildSSPlugin(data: SSFormValues): string {
  if (!data.plugin) return ''

  const plugin: string[] = [data.plugin]

  if (data.plugin === 'v2ray-plugin') {
    plugin.push('tls')
    if (data.host) plugin.push(`host=${data.host}`)

    let path = data.path
    if (path) {
      if (!path.startsWith('/')) path = `/${path}`
      plugin.push(`path=${path}`)
    }
  } else {
    plugin.push(`obfs=${data.obfs}`)
    if (data.host) plugin.push(`obfs-host=${data.host}`)
    if (data.obfs === 'http' && data.path) plugin.push(`obfs-path=${data.path}`)
  }

  return plugin.join(';')
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
  if (data.alpn !== '') query.alpn = data.alpn

  let protocol = 'trojan'

  if (data.method !== 'origin' || data.obfs !== 'none') {
    protocol = 'trojan-go'
    query.type =
      data.obfs === 'websocket'
        ? 'ws'
        : data.obfs === 'httpupgrade'
          ? 'httpupgrade'
          : data.obfs === 'grpc'
            ? 'grpc'
            : 'original'

    if (data.method === 'shadowsocks') {
      query.encryption = `ss;${data.ssCipher};${data.ssPassword}`
    }

    if (query.type === 'ws' || query.type === 'httpupgrade') {
      query.host = data.host || ''
      query.path = data.path || '/'
    }
    if (query.type === 'grpc') {
      query.host = data.host || ''
      query.serviceName = data.path || ''
    }
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
    hash: data.name,
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
