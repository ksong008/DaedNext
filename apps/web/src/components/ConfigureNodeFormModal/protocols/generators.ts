import type { GenerateURLParams } from '@daeuniverse/dae-node-parser'
import type { z } from 'zod'
import type { httpSchema, hysteria2Schema, socks5Schema, v2rayProtocolSchema } from '~/constants'

import { generateHysteria2URL, generateURL } from '@daeuniverse/dae-node-parser'
import { Base64 } from 'js-base64'
import { buildSupportedXhttpExtra } from '~/utils/xhttp'

type V2rayGeneratorValues = z.infer<typeof v2rayProtocolSchema>
type Hysteria2GeneratorValues = z.infer<typeof hysteria2Schema>
type HTTPGeneratorValues = z.infer<typeof httpSchema> & { protocol: 'http' | 'https' }
type Socks5GeneratorValues = z.infer<typeof socks5Schema>

export function generateV2rayLink(data: V2rayGeneratorValues): string {
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
    mux,
    vlessEncryption,
  } = data

  if (protocol === 'vless') {
    const params: Record<string, unknown> = {
      type: net === 'h2' ? 'http' : net,
      security: tls,
      host,
      headerType: type,
      sni,
      allowInsecure,
    }

    if (net === 'tcp' && flow !== 'none') params.flow = flow
    if (net === 'grpc') {
      params.serviceName = path
      if (grpcMode !== 'gun') params.mode = grpcMode
      if (grpcAuthority) params.authority = grpcAuthority
    } else if (net === 'xhttp') {
      params.path = path
      if (xhttpMode) params.mode = xhttpMode
      const extra = buildSupportedXhttpExtra(data)
      if (extra) params.extra = extra
    } else if (net === 'meek') {
      params.url = path
    } else {
      params.path = path
    }
    if (mux) params.mux = 1

    if (alpn !== '') params.alpn = alpn
    if (ech !== '') params.ech = ech
    if ((tls === 'tls' || tls === 'reality') && fp !== '') params.fp = fp
    if (tls === 'reality') {
      params.pbk = pbk
      if (sid) params.sid = sid
      if (spx) params.spx = spx
      if (pqv) params.pqv = pqv
    }
    const encryption = vlessEncryption.trim()
    if (encryption !== '' && encryption !== 'none') params.encryption = encryption

    return generateURL({ protocol, username: id, host: add, port, hash: ps, params })
  }

  if (protocol === 'vmess') {
    const vmessNet = net === 'h2' ? 'http' : net
    const body: Record<string, unknown> = {
      v: data.v || '2',
      ps,
      add,
      port,
      id,
      aid: 0,
      scy: data.scy,
      net: vmessNet,
      type: '',
      host,
      path: ['ws', 'h2', 'httpupgrade', 'grpc'].includes(net) ? path : '',
      tls,
      sni,
      alpn,
      ech,
      fp,
      allowInsecure,
      grpcMode: net === 'grpc' ? grpcMode : 'gun',
      grpcAuthority: net === 'grpc' ? grpcAuthority : '',
    }
    return `vmess://${Base64.encode(JSON.stringify(body))}`
  }

  return ''
}

export function generateHysteria2Link(data: Hysteria2GeneratorValues): string {
  return generateHysteria2URL({
    protocol: 'hysteria2',
    auth: data.auth,
    host: data.server,
    port: data.port,
    params: {
      sni: data.sni,
      ports: data.ports || '',
      obfs: data.obfs,
      'obfs-password': data.obfs === 'salamander' ? data.obfsPassword : '',
      pinSHA256: data.pinSHA256,
      maxTx: data.maxTx,
      maxRx: data.maxRx,
    },
    hash: data.name,
  })
}

export function generateHTTPLink(data: HTTPGeneratorValues): string {
  const query: Record<string, unknown> = {}
  if (data.transport) {
    query.transport = true
    query.host = data.transportHost
  }
  if (data.protocol === 'https') {
    query.sni = data.sni
    if (data.allowInsecure) query.allowInsecure = true
    query.tlsImplementation = data.tlsImplementation
    query.alpn = data.alpn
    query.utlsImitate = data.utlsImitate
  }

  const params: GenerateURLParams = {
    protocol: data.protocol,
    host: data.host,
    port: data.port,
    hash: data.name,
    path: data.transport ? data.transportPath : '',
    params: query,
  }
  if (data.username && data.password) {
    params.username = data.username
    params.password = data.password
  }
  return generateURL(params)
}

export function generateSocks5Link(data: Socks5GeneratorValues): string {
  const params: GenerateURLParams = {
    protocol: 'socks5',
    host: data.host,
    port: data.port,
    hash: data.name,
  }
  if (data.username && data.password) {
    params.username = data.username
    params.password = data.password
  }
  return generateURL(params)
}
