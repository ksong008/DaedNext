import type { z } from 'zod'
import type { NodeFormProps } from './types'
import { parseSSRUrl } from '@daeuniverse/dae-node-parser'
import { Base64 } from 'js-base64'
import { createPortal } from 'react-dom'

import { FormActions } from '~/components/FormActions'
import { Input } from '~/components/ui/input'
import { NumberInput } from '~/components/ui/number-input'
import { Select } from '~/components/ui/select'
import { DEFAULT_SSR_FORM_VALUES, ssrSchema } from '~/constants'
import { useNodeForm } from '~/hooks'

export type SSRFormValues = z.infer<typeof ssrSchema>

function generateSSRLink(data: SSRFormValues): string {
  /* ssr://server:port:proto:method:obfs:URLBASE64(password)/?remarks=URLBASE64(remarks)&protoparam=URLBASE64(protoparam)&obfsparam=URLBASE64(obfsparam)) */
  return `ssr://${Base64.encode(
    `${data.server}:${data.port}:${data.proto}:${data.method}:${data.obfs}:${Base64.encodeURI(
      data.password,
    )}/?remarks=${Base64.encodeURI(data.name)}&protoparam=${Base64.encodeURI(
      data.protoParam,
    )}&obfsparam=${Base64.encodeURI(data.obfsParam)}`,
  )}`
}

export function SSRForm({ onLinkGeneration, initialValues, actionsPortal }: NodeFormProps<SSRFormValues>) {
  const { formValues, setValue, handleSubmit, onSubmit, submit, resetForm, isDirty, isValid, errors, t } = useNodeForm({
    schema: ssrSchema,
    defaultValues: DEFAULT_SSR_FORM_VALUES,
    initialValues,
    onLinkGeneration,
    generateLink: generateSSRLink,
    parseLink: parseSSRUrl,
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
        label="Method"
        withAsterisk
        data={[
          { label: 'aes-128-cfb', value: 'aes-128-cfb' },
          { label: 'aes-192-cfb', value: 'aes-192-cfb' },
          { label: 'aes-256-cfb', value: 'aes-256-cfb' },
        ]}
        value={formValues.method}
        onChange={(val) => setValue('method', (val || 'aes-128-cfb') as SSRFormValues['method'])}
      />

      <Select
        label={t('configureNode.protocol')}
        withAsterisk
        data={[{ label: 'origin', value: 'origin' }]}
        value={formValues.proto}
        onChange={(val) => setValue('proto', (val || 'origin') as SSRFormValues['proto'])}
      />

      <Select
        label={t('configureNode.obfs')}
        withAsterisk
        data={[{ label: 'http_simple', value: 'http_simple' }]}
        value={formValues.obfs}
        onChange={(val) => setValue('obfs', (val || 'http_simple') as SSRFormValues['obfs'])}
      />

      <Input
        label={t('configureNode.obfsParam')}
        value={formValues.obfsParam}
        onChange={(e) => setValue('obfsParam', e.target.value)}
      />

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
