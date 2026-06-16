import type { z } from 'zod'
import type { NodeFormProps } from './types'
import { generateURL, parseTrojanUrl } from '@daeuniverse/dae-node-parser'
import { createPortal } from 'react-dom'

import { FormActions } from '~/components/FormActions'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { NumberInput } from '~/components/ui/number-input'
import { Select } from '~/components/ui/select'
import { DEFAULT_TROJAN_FORM_VALUES, trojanSchema } from '~/constants'
import { useNodeForm } from '~/hooks'

export type TrojanFormValues = z.infer<typeof trojanSchema>

function generateTrojanLink(data: TrojanFormValues): string {
  const query: Record<string, unknown> = {
    allowInsecure: data.allowInsecure,
  }

  if (data.peer !== '') {
    query.sni = data.peer
  }
  if (data.alpn !== '') {
    query.alpn = data.alpn
  }

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

export function TrojanForm({ onLinkGeneration, initialValues, actionsPortal }: NodeFormProps<TrojanFormValues>) {
  const { formValues, setValue, handleSubmit, onSubmit, submit, resetForm, isDirty, isValid, errors, t } = useNodeForm({
    schema: trojanSchema,
    defaultValues: DEFAULT_TROJAN_FORM_VALUES,
    initialValues,
    onLinkGeneration,
    generateLink: generateTrojanLink,
    parseLink: parseTrojanUrl,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Input
        label={t('configureNode.name')}
        value={formValues.name}
        onChange={(e) => setValue('name', e.target.value)}
      />

      <Input
        label={t('configureNode.host')}
        withAsterisk
        value={formValues.server}
        onChange={(e) => setValue('server', e.target.value)}
      />

      <NumberInput
        label={t('configureNode.port')}
        withAsterisk
        min={0}
        max={65535}
        value={formValues.port}
        onChange={(val) => setValue('port', Number(val))}
      />

      <Input
        label={t('configureNode.password')}
        withAsterisk
        value={formValues.password}
        onChange={(e) => setValue('password', e.target.value)}
      />

      <Select
        label={t('configureNode.protocol')}
        withAsterisk
        data={[
          { label: 'origin', value: 'origin' },
          { label: 'shadowsocks', value: 'shadowsocks' },
        ]}
        value={formValues.method}
        onChange={(val) => {
          const method = (val || 'origin') as TrojanFormValues['method']
          setValue('method', method)
          if (method === 'shadowsocks') {
            setValue('obfs', 'websocket')
          }
        }}
      />

      {formValues.method === 'shadowsocks' && (
        <Select
          label="Shadowsocks Cipher"
          withAsterisk
          data={[
            { label: 'aes-128-gcm', value: 'aes-128-gcm' },
            { label: 'aes-256-gcm', value: 'aes-256-gcm' },
            { label: 'chacha20-poly1305', value: 'chacha20-poly1305' },
            { label: 'chacha20-ietf-poly1305', value: 'chacha20-ietf-poly1305' },
          ]}
          value={formValues.ssCipher}
          onChange={(val) => setValue('ssCipher', (val || 'aes-128-gcm') as TrojanFormValues['ssCipher'])}
        />
      )}

      {formValues.method === 'shadowsocks' && (
        <Input
          label="Shadowsocks password"
          withAsterisk
          value={formValues.ssPassword}
          onChange={(e) => setValue('ssPassword', e.target.value)}
        />
      )}

      <Checkbox
        label={t('allowInsecure')}
        checked={formValues.allowInsecure}
        onCheckedChange={(checked) => setValue('allowInsecure', !!checked)}
      />

      <Input label="SNI(Peer)" value={formValues.peer} onChange={(e) => setValue('peer', e.target.value)} />
      <Input label="ALPN" value={formValues.alpn} onChange={(e) => setValue('alpn', e.target.value)} />

      <Select
        label="Transport"
        data={
          formValues.method === 'shadowsocks'
            ? [{ label: 'websocket', value: 'websocket' }]
            : [
                { label: t('configureNode.noObfuscation'), value: 'none' },
                { label: 'websocket', value: 'websocket' },
                { label: 'httpupgrade', value: 'httpupgrade' },
                { label: 'grpc', value: 'grpc' },
              ]
        }
        value={formValues.obfs}
        onChange={(val) => setValue('obfs', (val || 'none') as TrojanFormValues['obfs'])}
      />

      {(formValues.obfs === 'websocket' || formValues.obfs === 'httpupgrade' || formValues.obfs === 'grpc') && (
        <Input
          label={formValues.obfs === 'grpc' ? 'gRPC Host' : t('configureNode.websocketHost')}
          value={formValues.host}
          onChange={(e) => setValue('host', e.target.value)}
        />
      )}

      {(formValues.obfs === 'websocket' || formValues.obfs === 'httpupgrade' || formValues.obfs === 'grpc') && (
        <Input
          label={formValues.obfs === 'grpc' ? 'ServiceName' : t('configureNode.websocketPath')}
          value={formValues.path}
          onChange={(e) => setValue('path', e.target.value)}
        />
      )}

      {actionsPortal ? (
        createPortal(
          <FormActions
            reset={resetForm}
            onSubmit={submit}
            isDirty={isDirty}
            isValid={isValid}
            errors={errors}
            requireDirty={false}
          />,
          actionsPortal,
        )
      ) : (
        <FormActions reset={resetForm} isDirty={isDirty} isValid={isValid} errors={errors} requireDirty={false} />
      )}
    </form>
  )
}
