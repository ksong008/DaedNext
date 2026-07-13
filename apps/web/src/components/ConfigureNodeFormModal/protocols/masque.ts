import type { MasqueConfig } from '@daeuniverse/dae-node-parser'
import type { ProtocolConfig } from './types'
import { generateMasqueURL, isValidMasqueTargetTemplate, parseMasqueUrl } from '@daeuniverse/dae-node-parser'
import { z } from 'zod'

export const DEFAULT_MASQUE_TARGET_TEMPLATE = '/.well-known/masque/udp/{target_host}/{target_port}/'

const masqueSchema = z
  .object({
    name: z.string(),
    host: z.string().trim().min(1, 'Proxy host is required'),
    port: z.number().int().min(0).max(65535),
    transport: z.enum(['h2', 'h3']),
    authentication: z.enum(['none', 'basic']),
    username: z.string(),
    password: z.string(),
    targetTemplate: z.string().refine(isValidMasqueTargetTemplate, 'Invalid CONNECT-UDP URI Template'),
    sni: z.string(),
    allowInsecure: z.boolean(),
  })
  .superRefine((data, context) => {
    if (data.authentication === 'basic' && !data.username) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['username'],
        message: 'Basic authentication requires a username',
      })
    }
  })

export type MasqueFormValues = z.infer<typeof masqueSchema>

const defaultValues: MasqueFormValues = {
  name: '',
  host: '',
  port: 0,
  transport: 'h3',
  authentication: 'none',
  username: '',
  password: '',
  targetTemplate: DEFAULT_MASQUE_TARGET_TEMPLATE,
  sni: '',
  allowInsecure: false,
}

export const masqueProtocol: ProtocolConfig<MasqueFormValues> = {
  id: 'masque',
  label: 'CONNECT-UDP',
  schema: masqueSchema,
  defaultValues,
  generateLink: (data) => generateMasqueURL(data as MasqueConfig),
  parseLink: parseMasqueUrl,
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
      name: 'transport',
      label: 'CONNECT-UDP Transport',
      type: 'select',
      options: [
        { label: 'HTTP/2 (h2)', value: 'h2' },
        { label: 'HTTP/3 (h3)', value: 'h3' },
      ],
    },
    {
      name: 'authentication',
      label: 'Authentication',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Basic', value: 'basic' },
      ],
    },
    {
      name: 'username',
      label: 'configureNode.username',
      type: 'text',
      required: true,
      visible: (values) => values.authentication === 'basic',
    },
    {
      name: 'password',
      label: 'configureNode.password',
      type: 'password',
      visible: (values) => values.authentication === 'basic',
    },
    {
      name: 'targetTemplate',
      label: 'Target URI Template',
      type: 'text',
      required: true,
      description: 'Must contain exactly one {target_host} and one {target_port}.',
    },
    {
      name: 'sni',
      label: 'SNI',
      type: 'text',
      placeholder: 'Defaults to proxy host',
    },
    {
      name: 'allowInsecure',
      label: 'AllowInsecure',
      type: 'checkbox',
    },
  ],
}
