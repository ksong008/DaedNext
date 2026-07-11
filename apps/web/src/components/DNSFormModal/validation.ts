export interface DNSFormValues {
  name: string
  text: string
}

export interface DNSFormValidationErrors {
  name?: 'required'
  text?: 'required'
}

export function validateDNSFormValues(values: DNSFormValues): DNSFormValidationErrors {
  const errors: DNSFormValidationErrors = {}
  if (!values.name.trim()) {
    errors.name = 'required'
  }
  if (!values.text.trim()) {
    errors.text = 'required'
  }
  return errors
}
