import type { NodeFormProps } from './types'
import { generateURL, parseV2rayUrl } from '@daeuniverse/dae-node-parser'
import { Base64 } from 'js-base64'
import { createPortal } from 'react-dom'
import { z } from 'zod'

import { FormActions } from '~/components/FormActions'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { NumberInput } from '~/components/ui/number-input'
import { Select } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { DEFAULT_V2RAY_FORM_VALUES, v2raySchema } from '~/constants'
import { useNodeForm } from '~/hooks'

const formSchema = v2raySchema.extend({
  protocol: z.enum(['vmess', 'vless']),
})

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

const XHTTP_PLACEMENT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Path', value: 'path' },
  { label: 'Query', value: 'query' },
  { label: 'Header', value: 'header' },
  { label: 'Cookie', value: 'cookie' },
]

const XHTTP_PADDING_PLACEMENT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Header', value: 'header' },
  { label: 'Cookie', value: 'cookie' },
  { label: 'Query', value: 'query' },
  { label: 'QueryInHeader', value: 'queryInHeader' },
]

const XHTTP_PADDING_METHOD_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'repeat-x', value: 'repeat-x' },
  { label: 'tokenish', value: 'tokenish' },
]

const XHTTP_UPLINK_DATA_PLACEMENT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Body', value: 'body' },
  { label: 'Header', value: 'header' },
  { label: 'Cookie', value: 'cookie' },
  { label: 'Auto', value: 'auto' },
]

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
        // No operation, skip
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

    if (!(body.protocol === 'vless' && body.tls === 'xtls')) {
      delete body.flow
    }

    return `vmess://${Base64.encode(JSON.stringify(body))}`
  }

  return ''
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
  const isCustomAlpn =
    formValues.alpn !== '' && !COMMON_ALPN_OPTIONS.some((option) => option.value === formValues.alpn)
  const alpnSelectValue = isCustomAlpn ? '__custom__' : formValues.alpn || undefined

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Select
        label={t('configureNode.protocol')}
        data={[
          { label: 'VMESS', value: 'vmess' },
          { label: 'VLESS', value: 'vless' },
        ]}
        value={formValues.protocol}
        onChange={(val) => setValue('protocol', (val || 'vmess') as 'vless' | 'vmess')}
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
        <NumberInput
          label="AlterID"
          min={0}
          max={65535}
          value={formValues.aid}
          onChange={(val) => setValue('aid', Number(val))}
        />
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
          data={[
            { label: 'off', value: 'none' },
            { label: 'tls', value: 'tls' },
            { label: 'reality', value: 'reality' },
          ]}
          value={formValues.tls}
          onChange={(val) => setValue('tls', (val || 'none') as V2rayFormValues['tls'])}
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

      <Select
        label="Flow"
        data={[
          { label: 'none', value: 'none' },
          { label: 'xtls-rprx-vision', value: 'xtls-rprx-vision' },
          { label: 'xtls-rprx-vision-udp443', value: 'xtls-rprx-vision-udp443' },
        ]}
        value={formValues.flow}
        onChange={(val) => setValue('flow', (val || 'none') as V2rayFormValues['flow'])}
      />

      {formValues.tls !== 'none' && (
        <Checkbox
          label="AllowInsecure"
          checked={formValues.allowInsecure}
          onCheckedChange={(checked) => setValue('allowInsecure', !!checked)}
        />
      )}

      <Select
        label={t('configureNode.network')}
        data={[
          { label: 'TCP', value: 'tcp' },
          { label: 'mKCP', value: 'kcp' },
          { label: 'WebSocket', value: 'ws' },
          { label: 'HTTP/2', value: 'h2' },
          { label: 'gRPC', value: 'grpc' },
          { label: 'HTTPUpgrade', value: 'httpupgrade' },
          { label: 'XHTTP', value: 'xhttp' },
        ]}
        value={formValues.net}
        onChange={(val) => setValue('net', (val || 'tcp') as V2rayFormValues['net'])}
      />

      {formValues.net === 'tcp' && (
        <Select
          label={t('configureNode.type')}
          data={[
            { label: t('configureNode.noObfuscation'), value: 'none' },
            { label: t('configureNode.httpObfuscation'), value: 'srtp' },
          ]}
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
        formValues.net === 'xhttp' ||
        formValues.tls === 'tls' ||
        (formValues.net === 'tcp' && formValues.type === 'http')) && (
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
        (formValues.net === 'tcp' && formValues.type === 'http')) && (
        <Input
          label={t('configureNode.path')}
          value={formValues.path}
          onChange={(e) => setValue('path', e.target.value)}
        />
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
              onChange={(val) => setValue('xhttpMode', val || 'auto')}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">DownloadSettings JSON</label>
              <Textarea value={formValues.downloadSettingsRaw} onChange={(e) => setValue('downloadSettingsRaw', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">XMUX JSON</label>
              <Textarea value={formValues.xmuxRaw} onChange={(e) => setValue('xmuxRaw', e.target.value)} />
            </div>
          </div>

          <details className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Advanced XHTTP</summary>
            <div className="mt-3 space-y-3">
              <Input label="XPadding Bytes" value={formValues.xPaddingBytes} onChange={(e) => setValue('xPaddingBytes', e.target.value)} />
              <Checkbox
                label="XPadding Obfs Mode"
                checked={formValues.xPaddingObfsMode}
                onCheckedChange={(checked) => setValue('xPaddingObfsMode', !!checked)}
              />
              <Input label="XPadding Key" value={formValues.xPaddingKey} onChange={(e) => setValue('xPaddingKey', e.target.value)} />
              <Input label="XPadding Header" value={formValues.xPaddingHeader} onChange={(e) => setValue('xPaddingHeader', e.target.value)} />
              <Select
                label="XPadding Placement"
                data={XHTTP_PADDING_PLACEMENT_OPTIONS}
                value={formValues.xPaddingPlacement || undefined}
                onChange={(val) => setValue('xPaddingPlacement', val || '')}
              />
              <Select
                label="XPadding Method"
                data={XHTTP_PADDING_METHOD_OPTIONS}
                value={formValues.xPaddingMethod || undefined}
                onChange={(val) => setValue('xPaddingMethod', val || '')}
              />

              <Checkbox
                label="No SSE Header"
                checked={formValues.noSSEHeader}
                onCheckedChange={(checked) => setValue('noSSEHeader', !!checked)}
              />
              <Input label="ScMaxEachPostBytes" value={formValues.scMaxEachPostBytes} onChange={(e) => setValue('scMaxEachPostBytes', e.target.value)} />
              <Input label="ScMinPostsIntervalMs" value={formValues.scMinPostsIntervalMs} onChange={(e) => setValue('scMinPostsIntervalMs', e.target.value)} />
              <NumberInput
                label="ScMaxBufferedPosts"
                min={0}
                value={formValues.scMaxBufferedPosts}
                onChange={(val) => setValue('scMaxBufferedPosts', Number(val) || 0)}
              />
              <Input label="Uplink HTTP Method" value={formValues.uplinkHTTPMethod} onChange={(e) => setValue('uplinkHTTPMethod', e.target.value)} />
              <Select
                label="Session Placement"
                data={XHTTP_PLACEMENT_OPTIONS}
                value={formValues.sessionPlacement || undefined}
                onChange={(val) => setValue('sessionPlacement', val || '')}
              />
              <Input label="Session Key" value={formValues.sessionKey} onChange={(e) => setValue('sessionKey', e.target.value)} />
              <Select
                label="Seq Placement"
                data={XHTTP_PLACEMENT_OPTIONS}
                value={formValues.seqPlacement || undefined}
                onChange={(val) => setValue('seqPlacement', val || '')}
              />
              <Input label="Seq Key" value={formValues.seqKey} onChange={(e) => setValue('seqKey', e.target.value)} />
              <Select
                label="Uplink Data Placement"
                data={XHTTP_UPLINK_DATA_PLACEMENT_OPTIONS}
                value={formValues.uplinkDataPlacement || undefined}
                onChange={(val) => setValue('uplinkDataPlacement', val || '')}
              />
              <Input label="Uplink Data Key" value={formValues.uplinkDataKey} onChange={(e) => setValue('uplinkDataKey', e.target.value)} />
              <Input label="Uplink Chunk Size" value={formValues.uplinkChunkSize} onChange={(e) => setValue('uplinkChunkSize', e.target.value)} />
              <div className="space-y-2">
                <label className="text-sm font-medium">Raw Extra JSON</label>
                <Textarea value={formValues.xhttpExtra} onChange={(e) => setValue('xhttpExtra', e.target.value)} />
              </div>
            </div>
          </details>
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
