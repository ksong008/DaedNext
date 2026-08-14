export const ECH_CONFIG_LIST_MAX_BYTES = 65_537
export const ECH_CONFIG_LIST_MAX_BASE64_BYTES = 87_384

const STANDARD_BASE64_PATTERN = /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i

export function validateEchConfigListBase64(value: unknown, label = 'ECHConfigList'): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return `${label} must be a string`

  const input = value.trim()
  if (input === '') return null
  if (input !== value) return `${label} cannot contain leading or trailing whitespace`
  if (input.length > ECH_CONFIG_LIST_MAX_BASE64_BYTES) {
    return `${label} base64 length exceeds ${ECH_CONFIG_LIST_MAX_BASE64_BYTES}`
  }
  if (!STANDARD_BASE64_PATTERN.test(input)) return `${label} must use padded standard Base64`

  try {
    if (atob(input).length > ECH_CONFIG_LIST_MAX_BYTES) {
      return `${label} decoded length exceeds ${ECH_CONFIG_LIST_MAX_BYTES}`
    }
  } catch {
    return `${label} must use padded standard Base64`
  }
  return null
}
