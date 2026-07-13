import type { z } from 'zod'
import type { NodeFormProps } from './types'
import { parseV2rayUrl } from '@daeuniverse/dae-node-parser'
import { createPortal } from 'react-dom'

import { FormActions } from '~/components/FormActions'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { NumberInput } from '~/components/ui/number-input'
import { Select } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { DEFAULT_V2RAY_FORM_VALUES, v2rayProtocolSchema } from '~/constants'
import { useNodeForm } from '~/hooks'
import { generateV2rayLink } from './protocols/generators'

const formSchema = v2rayProtocolSchema

export type V2rayFormValues = z.infer<typeof formSchema>

const defaultValues: V2rayFormValues = {
  protocol: 'vmess',
  ...DEFAULT_V2RAY_FORM_VALUES,
}

const COMMON_ALPN_OPTIONS = [
  { label: 'h2,http/1.1', value: 'h2,http/1.1' },
  { label: 'http/1.1', value: 'http/1.1' },
  { label: 'h2', value: 'h2' },
  { label: 'h3', value: 'h3' },
  { label: 'Custom', value: '__custom__' },
]

const XHTTP_MODE_OPTIONS = [
  { label: 'Auto (recommended)', value: 'auto' },
  { label: 'stream-up', value: 'stream-up' },
  { label: 'stream-one', value: 'stream-one' },
  { label: 'packet-up', value: 'packet-up' },
]

const VMESS_NETWORK_OPTIONS = [
  { label: 'TCP', value: 'tcp' },
  { label: 'WebSocket', value: 'ws' },
  { label: 'HTTP/2', value: 'h2' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'HTTPUpgrade', value: 'httpupgrade' },
]

const VLESS_NETWORK_OPTIONS = [
  { label: 'TCP', value: 'tcp' },
  { label: 'WebSocket', value: 'ws' },
  { label: 'HTTP/2', value: 'h2' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'HTTPUpgrade', value: 'httpupgrade' },
  { label: 'XHTTP', value: 'xhttp' },
  { label: 'Meek', value: 'meek' },
]

function networkOptions(protocol: V2rayFormValues['protocol']) {
  return protocol === 'vmess' ? VMESS_NETWORK_OPTIONS : VLESS_NETWORK_OPTIONS
}

export function V2rayForm({ onLinkGeneration, initialValues, actionsPortal }: NodeFormProps<V2rayFormValues>) {
  const { formValues, setValue, handleSubmit, onSubmit, submit, resetForm, isDirty, isValid, errors, t } = useNodeForm({
    schema: formSchema,
    defaultValues,
    initialValues,
    onLinkGeneration,
    generateLink: generateV2rayLink,
    parseLink: parseV2rayUrl,
  })
  const isCustomAlpn = formValues.alpn !== '' && !COMMON_ALPN_OPTIONS.some((option) => option.value === formValues.alpn)
  const alpnSelectValue = isCustomAlpn ? '__custom__' : formValues.alpn || undefined
  const currentNetworkOptions = networkOptions(formValues.protocol || 'vmess')
  const supportsFlow = formValues.protocol === 'vless' && formValues.net === 'tcp'
  const supportsMux =
    formValues.protocol === 'vless' &&
    formValues.net === 'tcp' &&
    formValues.tls === 'tls' &&
    formValues.flow === 'none'
  const pathLabel =
    formValues.net === 'meek' ? 'Meek URL' : formValues.net === 'grpc' ? 'ServiceName' : t('configureNode.path')

  const setProtocol = (protocol: V2rayFormValues['protocol']) => {
    setValue('protocol', protocol)
    setValue('aid', 0)
    setValue('flow', 'none')
    setValue('mux', false)
    setValue('type', 'none')
    if (protocol === 'vmess') {
      if (!VMESS_NETWORK_OPTIONS.some((option) => option.value === formValues.net)) {
        setValue('net', 'tcp')
      }
      if (formValues.tls === 'reality') {
        setValue('tls', 'tls')
      }
    }
  }

  const setNetwork = (net: V2rayFormValues['net']) => {
    setValue('net', net)
    if (net !== 'tcp') {
      setValue('flow', 'none')
      setValue('mux', false)
      setValue('type', 'none')
    }
    if (formValues.protocol === 'vmess' && (net === 'grpc' || net === 'h2')) {
      setValue('tls', 'tls')
    }
    if (formValues.protocol === 'vless' && net !== 'tcp' && formValues.tls === 'none') {
      setValue('tls', 'tls')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Select
        label={t('configureNode.protocol')}
        data={[
          { label: 'VMESS', value: 'vmess' },
          { label: 'VLESS', value: 'vless' },
        ]}
        value={formValues.protocol}
        onChange={(val) => setProtocol((val || 'vmess') as 'vless' | 'vmess')}
      />

      <Input label={t('configureNode.name')} value={formValues.ps} onChange={(e) => setValue('ps', e.target.value)} />

      <Input
        label={t('configureNode.host')}
        withAsterisk
        value={formValues.add}
        onChange={(e) => setValue('add', e.target.value)}
      />

      <NumberInput
        label={t('configureNode.port')}
        withAsterisk
        min={0}
        max={65535}
        value={formValues.port}
        onChange={(val) => setValue('port', Number(val))}
      />

      <Input label="ID" withAsterisk value={formValues.id} onChange={(e) => setValue('id', e.target.value)} />

      {formValues.protocol === 'vmess' && (
        <NumberInput label="AlterID" min={0} max={0} value={formValues.aid} onChange={() => setValue('aid', 0)} />
      )}

      {formValues.protocol === 'vmess' && (
        <Select
          label={t('configureNode.security')}
          data={[
            { label: 'auto', value: 'auto' },
            { label: 'aes-128-gcm', value: 'aes-128-gcm' },
            { label: 'chacha20-poly1305', value: 'chacha20-poly1305' },
            { label: 'none', value: 'none' },
            { label: 'zero', value: 'zero' },
          ]}
          value={formValues.scy}
          onChange={(val) => setValue('scy', (val || 'auto') as V2rayFormValues['scy'])}
        />
      )}

      {formValues.type !== 'dtls' && (
        <Select
          label="TLS"
          data={
            formValues.protocol === 'vmess'
              ? [
                  { label: 'off', value: 'none' },
                  { label: 'tls', value: 'tls' },
                ]
              : [
                  { label: 'off', value: 'none' },
                  { label: 'tls', value: 'tls' },
                  { label: 'reality', value: 'reality' },
                ]
          }
          value={formValues.tls}
          onChange={(val) => {
            const tls = (val || 'none') as V2rayFormValues['tls']
            setValue('tls', tls)
            if (tls !== 'tls') setValue('mux', false)
            if (tls === 'none') setValue('flow', 'none')
          }}
        />
      )}

      {formValues.tls !== 'none' && (
        <Input label="SNI" value={formValues.sni} onChange={(e) => setValue('sni', e.target.value)} />
      )}

      {(formValues.tls === 'reality' || (formValues.protocol === 'vless' && formValues.tls === 'tls')) && (
        <Select
          label={t('configureNode.fingerprint')}
          data={[
            { label: 'chrome', value: 'chrome' },
            { label: 'firefox', value: 'firefox' },
            { label: 'safari', value: 'safari' },
            { label: 'edge', value: 'edge' },
            { label: 'ios', value: 'ios' },
            { label: 'android', value: 'android' },
            { label: 'random', value: 'random' },
            { label: 'randomized', value: 'randomized' },
          ]}
          value={formValues.fp || 'chrome'}
          onChange={(val) => setValue('fp', val || 'chrome')}
        />
      )}

      {formValues.tls === 'reality' && (
        <>
          <Input
            label={t('configureNode.publicKey')}
            withAsterisk
            value={formValues.pbk}
            onChange={(e) => setValue('pbk', e.target.value)}
          />
          <Input
            label={t('configureNode.shortId')}
            value={formValues.sid}
            onChange={(e) => setValue('sid', e.target.value)}
          />
          <Input
            label={t('configureNode.spiderX')}
            value={formValues.spx}
            onChange={(e) => setValue('spx', e.target.value)}
          />
          <Input label="PQV (ML-DSA-65)" value={formValues.pqv} onChange={(e) => setValue('pqv', e.target.value)} />
        </>
      )}

      {supportsFlow && (
        <Select
          label="Flow"
          data={[
            { label: 'none', value: 'none' },
            { label: 'xtls-rprx-vision', value: 'xtls-rprx-vision' },
            { label: 'xtls-rprx-vision-udp443', value: 'xtls-rprx-vision-udp443' },
          ]}
          value={formValues.flow}
          onChange={(val) => {
            const flow = (val || 'none') as V2rayFormValues['flow']
            setValue('flow', flow)
            if (flow !== 'none') setValue('mux', false)
          }}
        />
      )}

      {supportsMux && (
        <Checkbox label="Mux" checked={formValues.mux} onCheckedChange={(checked) => setValue('mux', !!checked)} />
      )}

      {formValues.tls !== 'none' && (
        <Checkbox
          label="AllowInsecure"
          checked={formValues.allowInsecure}
          onCheckedChange={(checked) => setValue('allowInsecure', !!checked)}
        />
      )}

      <Select
        label={t('configureNode.network')}
        data={currentNetworkOptions}
        value={formValues.net}
        onChange={(val) => {
          const net = (val || 'tcp') as V2rayFormValues['net']
          setNetwork(net)
        }}
      />

      {formValues.net === 'tcp' && (
        <Select
          label={t('configureNode.type')}
          data={[{ label: t('configureNode.noObfuscation'), value: 'none' }]}
          value={formValues.type}
          onChange={(val) => setValue('type', (val || 'none') as V2rayFormValues['type'])}
        />
      )}

      {formValues.net === 'kcp' && (
        <Select
          label={t('configureNode.type')}
          data={[
            { label: t('configureNode.noObfuscation'), value: 'none' },
            { label: t('configureNode.srtpObfuscation'), value: 'srtp' },
            { label: t('configureNode.utpObfuscation'), value: 'utp' },
            { label: t('configureNode.wechatVideoObfuscation'), value: 'wechat-video' },
            { label: t('configureNode.dtlsObfuscation'), value: 'dtls' },
            { label: t('configureNode.wireguardObfuscation'), value: 'wireguard' },
          ]}
          value={formValues.type}
          onChange={(val) => setValue('type', (val || 'none') as V2rayFormValues['type'])}
        />
      )}

      {(formValues.net === 'ws' ||
        formValues.net === 'h2' ||
        formValues.net === 'httpupgrade' ||
        formValues.net === 'grpc' ||
        formValues.net === 'xhttp') && (
        <Input
          label={t('configureNode.host')}
          value={formValues.host}
          onChange={(e) => setValue('host', e.target.value)}
        />
      )}

      {formValues.tls === 'tls' && (
        <>
          <Select
            label="ALPN"
            data={COMMON_ALPN_OPTIONS}
            value={alpnSelectValue}
            onChange={(val) => {
              if (!val) {
                setValue('alpn', '')
                return
              }
              if (val === '__custom__') {
                if (!isCustomAlpn) {
                  setValue('alpn', '')
                }
                return
              }
              setValue('alpn', val)
            }}
            placeholder="Select ALPN"
          />
          {(isCustomAlpn || formValues.alpn === '') && (
            <Input
              label="Custom ALPN"
              placeholder="e.g. h2,http/1.1"
              value={formValues.alpn}
              onChange={(e) => setValue('alpn', e.target.value)}
            />
          )}
          <Input
            label="ECH"
            placeholder="Encrypted Client Hello"
            value={formValues.ech}
            onChange={(e) => setValue('ech', e.target.value)}
          />
        </>
      )}

      {(formValues.net === 'ws' ||
        formValues.net === 'h2' ||
        formValues.net === 'httpupgrade' ||
        formValues.net === 'xhttp' ||
        formValues.net === 'meek') && (
        <Input label={pathLabel} value={formValues.path} onChange={(e) => setValue('path', e.target.value)} />
      )}

      {formValues.net === 'kcp' && (
        <Input label="Seed" value={formValues.path} onChange={(e) => setValue('path', e.target.value)} />
      )}

      {formValues.net === 'grpc' && (
        <>
          <Input label="ServiceName" value={formValues.path} onChange={(e) => setValue('path', e.target.value)} />
          <Select
            label="gRPC Mode"
            data={[
              { label: 'gun', value: 'gun' },
              { label: 'multi', value: 'multi' },
              { label: 'guna', value: 'guna' },
            ]}
            value={formValues.grpcMode}
            onChange={(val) => setValue('grpcMode', (val || 'gun') as V2rayFormValues['grpcMode'])}
          />
          <Input
            label="Authority"
            value={formValues.grpcAuthority}
            onChange={(e) => setValue('grpcAuthority', e.target.value)}
          />
        </>
      )}

      {formValues.net === 'xhttp' && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
            <Select
              label="XHTTP Mode"
              data={XHTTP_MODE_OPTIONS}
              value={formValues.xhttpMode || 'auto'}
              onChange={(val) => {
                const mode = val || 'auto'
                setValue('xhttpMode', mode)
                if (mode === 'stream-one') {
                  setValue('downloadSettingsRaw', '')
                }
              }}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">XHTTP Extra JSON</label>
              <Textarea
                value={formValues.xhttpExtra}
                aria-invalid={!!errors.xhttpExtra}
                onChange={(e) => setValue('xhttpExtra', e.target.value)}
              />
              {errors.xhttpExtra?.message && <p className="text-xs text-destructive">{errors.xhttpExtra.message}</p>}
            </div>

            {formValues.xhttpMode !== 'stream-one' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">DownloadSettings JSON</label>
                <Textarea
                  value={formValues.downloadSettingsRaw}
                  aria-invalid={!!errors.downloadSettingsRaw}
                  onChange={(e) => setValue('downloadSettingsRaw', e.target.value)}
                />
                {errors.downloadSettingsRaw?.message && (
                  <p className="text-xs text-destructive">{errors.downloadSettingsRaw.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">XMUX JSON</label>
              <Textarea
                value={formValues.xmuxRaw}
                aria-invalid={!!errors.xmuxRaw}
                onChange={(e) => setValue('xmuxRaw', e.target.value)}
              />
              {errors.xmuxRaw?.message && <p className="text-xs text-destructive">{errors.xmuxRaw.message}</p>}
            </div>
          </div>
        </div>
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
