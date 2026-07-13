import type { NodeFormProps } from './types'
import { parseHTTPUrl } from '@daeuniverse/dae-node-parser'
import { createPortal } from 'react-dom'
import { z } from 'zod'

import { FormActions } from '~/components/FormActions'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { NumberInput } from '~/components/ui/number-input'
import { Select } from '~/components/ui/select'
import { DEFAULT_HTTP_FORM_VALUES, httpSchema } from '~/constants'
import { useNodeForm } from '~/hooks'
import { generateHTTPLink } from './protocols/generators'

const formSchema = httpSchema.extend({
  protocol: z.enum(['http', 'https']),
})

export type HTTPFormValues = z.infer<typeof formSchema>

const defaultValues: HTTPFormValues = {
  protocol: 'http',
  ...DEFAULT_HTTP_FORM_VALUES,
}

export function HTTPForm({ onLinkGeneration, initialValues, actionsPortal }: NodeFormProps<HTTPFormValues>) {
  const { formValues, setValue, handleSubmit, onSubmit, submit, resetForm, isDirty, isValid, errors, t } = useNodeForm({
    schema: formSchema,
    defaultValues,
    initialValues,
    onLinkGeneration,
    generateLink: generateHTTPLink,
    parseLink: parseHTTPUrl,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Select
        label={t('configureNode.protocol')}
        data={[
          { label: 'HTTP', value: 'http' },
          { label: 'HTTPS', value: 'https' },
        ]}
        value={formValues.protocol}
        onChange={(val) => setValue('protocol', val as 'http' | 'https')}
      />

      <Input
        label={t('configureNode.name')}
        value={formValues.name}
        onChange={(e) => setValue('name', e.target.value)}
      />

      <Input
        label={t('configureNode.host')}
        withAsterisk
        value={formValues.host}
        onChange={(e) => setValue('host', e.target.value)}
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
        label={t('configureNode.username')}
        value={formValues.username}
        onChange={(e) => setValue('username', e.target.value)}
      />

      <Input
        label={t('configureNode.password')}
        value={formValues.password}
        onChange={(e) => setValue('password', e.target.value)}
      />

      <Checkbox
        label="HTTP Transport"
        checked={formValues.transport}
        onCheckedChange={(checked) => setValue('transport', !!checked)}
      />

      {formValues.transport && (
        <>
          <Input
            label="Transport Host"
            value={formValues.transportHost}
            onChange={(e) => setValue('transportHost', e.target.value)}
          />
          <Input
            label="Transport Path"
            value={formValues.transportPath}
            onChange={(e) => setValue('transportPath', e.target.value)}
          />
        </>
      )}

      {formValues.protocol === 'https' && (
        <>
          <Input label="SNI" value={formValues.sni} onChange={(e) => setValue('sni', e.target.value)} />
          <Select
            label="TLS Implementation"
            data={[
              { label: 'tls', value: 'tls' },
              { label: 'utls', value: 'utls' },
            ]}
            value={formValues.tlsImplementation}
            onChange={(val) => setValue('tlsImplementation', (val || 'tls') as HTTPFormValues['tlsImplementation'])}
          />
          <Input
            label="uTLS Imitate"
            value={formValues.utlsImitate}
            onChange={(e) => setValue('utlsImitate', e.target.value)}
          />
          <Input label="ALPN" value={formValues.alpn} onChange={(e) => setValue('alpn', e.target.value)} />
          <Checkbox
            label="AllowInsecure"
            checked={formValues.allowInsecure}
            onCheckedChange={(checked) => setValue('allowInsecure', !!checked)}
          />
        </>
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
