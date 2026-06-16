import { z } from 'zod'
import { validateXhttpFormFields } from '~/utils/xhttp'

const UNSIGNED_INTEGER_PATTERN = /^\d+$/

export const v2raySchema = z
  .object({
    ps: z.string(),
    add: z.string().nonempty(),
    port: z.number().min(0).max(65535),
    id: z.string().nonempty(),
    aid: z.number().min(0).max(65535),
    net: z.enum(['tcp', 'kcp', 'ws', 'http', 'h2', 'grpc', 'httpupgrade', 'xhttp', 'meek']),
    type: z.enum(['none', 'http', 'srtp', 'utp', 'wechat-video', 'dtls', 'wireguard']),
    host: z.string(),
    path: z.string(),
    // gRPC specific
    grpcMode: z.enum(['gun', 'multi', 'guna']),
    grpcAuthority: z.string(),
    // XHTTP specific
    xhttpMode: z.string(),
    xhttpExtra: z.string(),
    xPaddingBytes: z.string(),
    xPaddingObfsMode: z.boolean(),
    xPaddingKey: z.string(),
    xPaddingHeader: z.string(),
    xPaddingPlacement: z.string(),
    xPaddingMethod: z.string(),
    noSSEHeader: z.boolean(),
    scMaxEachPostBytes: z.string(),
    scMinPostsIntervalMs: z.string(),
    scMaxBufferedPosts: z.number().min(0),
    uplinkHTTPMethod: z.string(),
    sessionPlacement: z.string(),
    sessionKey: z.string(),
    seqPlacement: z.string(),
    seqKey: z.string(),
    uplinkDataPlacement: z.string(),
    uplinkDataKey: z.string(),
    uplinkChunkSize: z.string(),
    downloadSettingsRaw: z.string(),
    xmuxRaw: z.string(),
    // TLS fields (xtls is deprecated, use reality instead)
    tls: z.enum(['none', 'tls', 'reality']),
    flow: z.enum(['none', 'xtls-rprx-vision', 'xtls-rprx-vision-udp443']),
    alpn: z.string(),
    ech: z.string(), // Encrypted Client Hello
    scy: z.enum(['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none', 'zero']),
    v: z.string(),
    allowInsecure: z.boolean(),
    mux: z.boolean(),
    sni: z.string(),
    // Reality-specific fields
    pbk: z.string(), // public key
    fp: z.string(), // fingerprint
    sid: z.string(), // short ID
    spx: z.string(), // spider x (path)
    pqv: z.string(), // ML-DSA-65 public key (mldsa65Verify)
  })
  .superRefine((data, ctx) => {
    if (data.net !== 'xhttp') return

    for (const issue of validateXhttpFormFields(data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [issue.path],
        message: issue.message,
      })
    }
  })

export const v2rayProtocolSchema = v2raySchema
  .extend({
    protocol: z.enum(['vmess', 'vless']),
  })
  .superRefine((data, ctx) => {
    if (data.protocol === 'vmess') {
      if (!['tcp', 'ws', 'grpc', 'httpupgrade'].includes(data.net)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['net'],
          message: 'Resident VMess supports tcp, websocket, httpupgrade, and grpc only',
        })
      }
      if (data.tls === 'reality') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tls'],
          message: 'Reality is VLESS-only',
        })
      }
      if (data.net === 'grpc' && data.tls !== 'tls') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tls'],
          message: 'Resident VMess gRPC requires TLS',
        })
      }
      if (data.aid !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['aid'],
          message: 'Resident VMess supports AEAD only; AlterID must be 0',
        })
      }
      if (data.flow !== 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['flow'],
          message: 'VMess does not support VLESS flow',
        })
      }
      if (data.mux) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mux'],
          message: 'Resident VMess mux is not supported from manual nodes',
        })
      }
      return
    }

    if (!['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'meek'].includes(data.net)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['net'],
        message: 'Resident VLESS supports tcp, websocket, httpupgrade, grpc, xhttp, and meek only',
      })
    }
    if (data.tls === 'none' && (data.net !== 'tcp' || data.mux || data.flow !== 'none')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tls'],
        message: 'Resident VLESS security=none admits native tcp with empty flow only',
      })
    }
    if (data.net !== 'tcp' && data.flow !== 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['flow'],
        message: 'Resident VLESS wrapped transports require empty flow',
      })
    }
    if (data.net === 'tcp' && data.type !== 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'Resident VLESS TCP admits headerType=none only',
      })
    }
    if (data.mux && (data.net !== 'tcp' || data.tls !== 'tls' || data.flow !== 'none')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mux'],
        message: 'Resident VLESS mux admits tcp + tls + empty flow only',
      })
    }
    if (data.tls === 'reality' && data.pbk === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pbk'],
        message: 'Reality public key is required',
      })
    }
    if (data.net === 'meek') {
      try {
        const url = new URL(data.path)
        if (url.protocol !== 'https:') {
          throw new Error('not https')
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['path'],
          message: 'Resident VLESS meek requires a standard https URL',
        })
      }
    }
  })

export const ssSchema = z
  .object({
    type: z.enum(['ss', 'ss2022']),
    method: z.enum([
      'aes-128-gcm',
      'aes-256-gcm',
      'chacha20-poly1305',
      'chacha20-ietf-poly1305',
      '2022-blake3-aes-128-gcm',
      '2022-blake3-aes-256-gcm',
      '2022-blake3-chacha20-poly1305',
    ]),
    plugin: z.enum(['', 'simple-obfs', 'v2ray-plugin']),
    obfs: z.enum(['http', 'tls']),
    tls: z.enum(['', 'tls']),
    path: z.string(),
    mode: z.string(),
    host: z.string(),
    password: z.string().nonempty(),
    server: z.string().nonempty(),
    port: z.number().min(0).max(65535),
    name: z.string(),
    impl: z.enum(['', 'chained', 'transport']),
  })
  .superRefine((data, ctx) => {
    const isSS2022Method = data.method.startsWith('2022-blake3-')
    if (data.type === 'ss' && isSS2022Method) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['method'],
        message: 'SS methods cannot use SS2022 ciphers',
      })
    }
    if (data.type === 'ss2022' && !isSS2022Method) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['method'],
        message: 'SS2022 requires a 2022-blake3-* cipher',
      })
    }
    if (data.impl !== '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['impl'],
        message: 'Resident Shadowsocks does not support selecting a plugin implementation',
      })
    }
    if (data.plugin === 'v2ray-plugin') {
      if (data.tls !== 'tls') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tls'],
          message: 'Resident v2ray-plugin requires TLS',
        })
      }
      if (data.mode !== '' && data.mode !== 'websocket') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mode'],
          message: 'Resident v2ray-plugin only supports WebSocket mode',
        })
      }
    }
    if (data.type === 'ss2022' && data.plugin !== '' && !(data.plugin === 'simple-obfs' && data.obfs === 'http')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plugin'],
        message: 'SS2022 supports no plugin or simple-obfs http only',
      })
    }
    if (data.type === 'ss2022' && data.plugin === 'simple-obfs' && data.obfs !== 'http') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['obfs'],
        message: 'SS2022 simple-obfs supports http only',
      })
    }
    if (data.type === 'ss2022') {
      const expectedLen = data.method === '2022-blake3-aes-128-gcm' ? 16 : 32
      const pskParts = data.password.split(':')
      if (pskParts.some((part) => part.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'PSK list must not contain empty segments',
        })
      } else {
        for (const part of pskParts) {
          try {
            const decoded = atob(part)
            if (decoded.length !== expectedLen) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['password'],
                message: `Each PSK must decode to ${expectedLen} bytes`,
              })
              break
            }
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['password'],
              message: 'Each PSK must be valid base64',
            })
            break
          }
        }
      }
    }
  })

export const ssrSchema = z
  .object({
    method: z.enum(['aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb']),
    password: z.string().nonempty(),
    server: z.string().nonempty(),
    port: z.number().min(0).max(65535).positive(),
    name: z.string(),
    proto: z.enum(['origin']),
    protoParam: z.string(),
    obfs: z.enum(['http_simple']),
    obfsParam: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.protoParam !== '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['protoParam'],
        message: 'Resident ShadowsocksR admits empty protocol parameter only',
      })
    }
  })

export const trojanSchema = z
  .object({
    name: z.string(),
    server: z.string().nonempty(),
    peer: z.string(),
    alpn: z.string(),
    host: z.string(),
    path: z.string(),
    allowInsecure: z.boolean(),
    port: z.number().min(0).max(65535),
    password: z.string().nonempty(),
    method: z.enum(['origin', 'shadowsocks']),
    ssCipher: z.enum(['aes-128-gcm', 'aes-256-gcm', 'chacha20-poly1305', 'chacha20-ietf-poly1305']),
    ssPassword: z.string(),
    obfs: z.enum(['none', 'websocket', 'httpupgrade', 'grpc']),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'shadowsocks' && data.obfs !== 'websocket') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['obfs'],
        message: 'Trojan inner Shadowsocks is resident-supported on WebSocket only',
      })
    }
    if (data.method === 'shadowsocks' && data.ssPassword === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ssPassword'],
        message: 'Trojan inner Shadowsocks requires a password',
      })
    }
  })

export const tuicSchema = z.object({
  name: z.string(),
  server: z.string().nonempty(),
  port: z.number().min(0).max(65535),
  uuid: z.string().nonempty(),
  password: z.string().nonempty(),
  allowInsecure: z.boolean(),
  disable_sni: z.boolean(),
  sni: z.string(),
  congestion_control: z.string(),
  alpn: z.string(),
  udp_relay_mode: z.string(),
})

export const juicitySchema = z.object({
  name: z.string(),
  server: z.string().nonempty(),
  port: z.number().min(0).max(65535),
  uuid: z.string().nonempty(),
  password: z.string().nonempty(),
  allowInsecure: z.boolean(),
  pinned_certchain_sha256: z.string(),
  sni: z.string(),
  congestion_control: z.string(),
})

export const hysteria2Schema = z
  .object({
    name: z.string(),
    server: z.string().nonempty(),
    port: z.number().min(0).max(65535),
    auth: z.string().nonempty(),
    sni: z.string(),
    ports: z.string().optional(),
    allowInsecure: z.boolean(),
    pinSHA256: z.string().nonempty(),
    maxTx: z.string(),
    maxRx: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.allowInsecure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowInsecure'],
        message: 'Resident Hysteria2 does not admit insecure mode',
      })
    }
    if ((data.maxTx === '') !== (data.maxRx === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.maxTx === '' ? ['maxTx'] : ['maxRx'],
        message: 'Hysteria2 maxTx and maxRx must be set together',
      })
    }
    for (const field of ['maxTx', 'maxRx'] as const) {
      if (data[field] !== '' && !UNSIGNED_INTEGER_PATTERN.test(data[field])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'Hysteria2 bandwidth values must be unsigned integers',
        })
      }
    }
  })

export const anytlsSchema = z.object({
  name: z.string(),
  server: z.string().nonempty(),
  port: z.number().min(0).max(65535),
  auth: z.string(),
  sni: z.string(),
  allowInsecure: z.boolean(),
})

export const httpSchema = z.object({
  username: z.string(),
  password: z.string(),
  host: z.string().nonempty(),
  port: z.number().min(0).max(65535),
  name: z.string(),
  sni: z.string(),
  allowInsecure: z.boolean(),
  transport: z.boolean(),
  transportHost: z.string(),
  transportPath: z.string(),
  tlsImplementation: z.enum(['tls', 'utls']),
  alpn: z.string(),
  utlsImitate: z.string(),
})

export const socks5Schema = z.object({
  username: z.string(),
  password: z.string(),
  host: z.string().nonempty(),
  port: z.number().min(0).max(65535),
  name: z.string(),
})
