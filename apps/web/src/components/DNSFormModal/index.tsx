import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Dialog, DialogTitle } from '~/components/ui/dialog'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from '~/components/ui/scrollable-dialog'

import { DNSForm } from './DNSForm'
import { validateDNSFormValues } from './validation'

interface DNSFormDisplayErrors {
  name?: string
  text?: string
}

export interface DNSFormModalProps {
  opened: boolean
  onClose: () => void
  title?: string
  initialValues?: {
    name: string
    text: string
  }
  handleSubmit: (values: { name: string; text: string }) => Promise<void>
}

export function DNSFormModal({ opened, onClose, title, initialValues, handleSubmit }: DNSFormModalProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<DNSFormDisplayErrors>({})
  const submitInFlightRef = useRef(false)

  const getValuesRef = useRef<(() => { name: string; text: string }) | null>(null)

  const onSubmit = async () => {
    if (!getValuesRef.current || submitInFlightRef.current) return

    const values = getValuesRef.current()
    const errors = validateDNSFormValues(values)
    if (errors.name || errors.text) {
      setValidationErrors({
        name: errors.name ? t('dnsConfig.nameRequired') : undefined,
        text: errors.text ? t('dnsConfig.configRequired') : undefined,
      })
      return
    }

    setValidationErrors({})
    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      await handleSubmit(values)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  const clearValidationError = useCallback((field: keyof DNSFormDisplayErrors) => {
    setValidationErrors((current) => {
      if (!current[field]) return current
      return { ...current, [field]: undefined }
    })
  }, [])

  const closeModal = useCallback(() => {
    setValidationErrors({})
    onClose()
  }, [onClose])

  return (
    <Dialog open={opened} onOpenChange={closeModal}>
      <ScrollableDialogContent size="lg">
        <ScrollableDialogHeader>
          <DialogTitle>{title || t('dns')}</DialogTitle>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
          <DNSForm
            key={`${initialValues?.name ?? 'new'}::${initialValues?.text ?? ''}`}
            initialName={initialValues?.name}
            initialConfig={initialValues?.text}
            opened={opened}
            bindGetValues={(fn) => {
              getValuesRef.current = fn
            }}
            validationErrors={validationErrors}
            onFieldChange={clearValidationError}
          />
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <Button variant="ghost" onClick={closeModal} disabled={submitting}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={onSubmit} loading={submitting}>
            {t('actions.confirm')}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
