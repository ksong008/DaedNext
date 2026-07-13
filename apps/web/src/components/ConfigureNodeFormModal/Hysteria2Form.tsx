import type { z } from 'zod'
import type { NodeFormProps } from './types'
import { parseHysteria2Url } from '@daeuniverse/dae-node-parser'
import { createPortal } from 'react-dom'

import { FormActions } from '~/components/FormActions'
import { Input } from '~/components/ui/input'
import { NumberInput } from '~/components/ui/number-input'
import { Select } from '~/components/ui/select'
import { DEFAULT_HYSTERIA2_FORM_VALUES, hysteria2Schema } from '~/constants'
import { useNodeForm } from '~/hooks'
import { generateHysteria2Link } from './protocols/generators'

export type Hysteria2FormValues = z.infer<typeof hysteria2Schema>

export function Hysteria2Form({ onLinkGeneration, initialValues, actionsPortal }: NodeFormProps<Hysteria2FormValues>) {
  const { formValues, setValue, handleSubmit, onSubmit, submit, resetForm, isDirty, isValid, errors, t } = useNodeForm({
    schema: hysteria2Schema,
    defaultValues: DEFAULT_HYSTERIA2_FORM_VALUES,
    initialValues,
    onLinkGeneration,
    generateLink: generateHysteria2Link,
    parseLink: parseHysteria2Url,
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
        label="Ports (Hopping)"
        placeholder="10000-20000,443"
        value={formValues.ports || ''}
        onChange={(e) => setValue('ports', e.target.value)}
      />
      <Input label="Auth" withAsterisk value={formValues.auth} onChange={(e) => setValue('auth', e.target.value)} />
      <Select
        label="Obfs"
        data={[
          { label: 'none', value: '' },
          { label: 'salamander', value: 'salamander' },
        ]}
        value={formValues.obfs || ''}
        onChange={(val) => {
          const obfs = (val || '') as Hysteria2FormValues['obfs']
          setValue('obfs', obfs)
          if (obfs === '') setValue('obfsPassword', '')
        }}
      />
      {formValues.obfs === 'salamander' && (
        <Input
          label={t('configureNode.obfsPassword')}
          withAsterisk
          value={formValues.obfsPassword}
          onChange={(e) => setValue('obfsPassword', e.target.value)}
        />
      )}
      <Input label="SNI" value={formValues.sni} onChange={(e) => setValue('sni', e.target.value)} />
      <Input
        label="Pin SHA256"
        withAsterisk
        value={formValues.pinSHA256}
        onChange={(e) => setValue('pinSHA256', e.target.value)}
      />
      <Input label="MaxTx" value={formValues.maxTx} onChange={(e) => setValue('maxTx', e.target.value)} />
      <Input label="MaxRx" value={formValues.maxRx} onChange={(e) => setValue('maxRx', e.target.value)} />
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
