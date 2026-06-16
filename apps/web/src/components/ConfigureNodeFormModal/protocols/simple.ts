import type { GenerateURLParams } from '@daeuniverse/dae-node-parser'
import type { ProtocolConfig } from './types'
import { generateURL, parseHTTPUrl, parseSocks5Url } from '@daeuniverse/dae-node-parser'
import { z } from 'zod'

import { DEFAULT_HTTP_FORM_VALUES, DEFAULT_SOCKS5_FORM_VALUES, httpSchema, socks5Schema } from '~/constants'

// ============================================================================
// HTTP Protocol
// ============================================================================

const httpFormSchema = httpSchema.extend({
  protocol: z.enum(['http', 'https']),
})

export type HTTPFormValues = z.infer<typeof httpFormSchema>

function generateHTTPLink(data: HTTPFormValues): string {
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

export const httpProtocol: ProtocolConfig<HTTPFormValues> = {
  id: 'http',
  label: 'HTTP',
  schema: httpFormSchema,
  defaultValues: {
    protocol: 'http',
    ...DEFAULT_HTTP_FORM_VALUES,
  },
  generateLink: generateHTTPLink,
  parseLink: parseHTTPUrl,
  fields: [
    {
      name: 'protocol',
      label: 'configureNode.protocol',
      type: 'select',
      options: [
        { label: 'HTTP', value: 'http' },
        { label: 'HTTPS', value: 'https' },
      ],
    },
    {
      name: 'name',
      label: 'configureNode.name',
      type: 'text',
    },
    {
      name: 'host',
      label: 'configureNode.host',
      type: 'text',
      required: true,
    },
    {
      name: 'port',
      label: 'configureNode.port',
      type: 'number',
      required: true,
      min: 0,
      max: 65535,
    },
    {
      name: 'username',
      label: 'configureNode.username',
      type: 'text',
    },
    {
      name: 'password',
      label: 'configureNode.password',
      type: 'text',
    },
    {
      name: 'transport',
      label: 'HTTP Transport',
      type: 'checkbox',
    },
    {
      name: 'transportHost',
      label: 'Transport Host',
      type: 'text',
      visible: (values) => values.transport === true,
    },
    {
      name: 'transportPath',
      label: 'Transport Path',
      type: 'text',
      visible: (values) => values.transport === true,
    },
    {
      name: 'sni',
      label: 'SNI',
      type: 'text',
      visible: (values) => values.protocol === 'https',
    },
    {
      name: 'tlsImplementation',
      label: 'TLS Implementation',
      type: 'select',
      options: [
        { label: 'tls', value: 'tls' },
        { label: 'utls', value: 'utls' },
      ],
      visible: (values) => values.protocol === 'https',
    },
    {
      name: 'utlsImitate',
      label: 'uTLS Imitate',
      type: 'text',
      visible: (values) => values.protocol === 'https',
    },
    {
      name: 'alpn',
      label: 'ALPN',
      type: 'text',
      visible: (values) => values.protocol === 'https',
    },
    {
      name: 'allowInsecure',
      label: 'AllowInsecure',
      type: 'checkbox',
      visible: (values) => values.protocol === 'https',
    },
  ],
}

// ============================================================================
// SOCKS5 Protocol
// ============================================================================

export type Socks5FormValues = z.infer<typeof socks5Schema>

function generateSocks5Link(data: Socks5FormValues): string {
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

export const socks5Protocol: ProtocolConfig<Socks5FormValues> = {
  id: 'socks5',
  label: 'SOCKS5',
  schema: socks5Schema,
  defaultValues: DEFAULT_SOCKS5_FORM_VALUES,
  generateLink: generateSocks5Link,
  parseLink: parseSocks5Url,
  fields: [
    {
      name: 'name',
      label: 'configureNode.name',
      type: 'text',
    },
    {
      name: 'host',
      label: 'configureNode.host',
      type: 'text',
      required: true,
    },
    {
      name: 'port',
      label: 'configureNode.port',
      type: 'number',
      required: true,
      min: 0,
      max: 65535,
    },
    {
      name: 'username',
      label: 'configureNode.username',
      type: 'text',
    },
    {
      name: 'password',
      label: 'configureNode.password',
      type: 'text',
    },
  ],
}
