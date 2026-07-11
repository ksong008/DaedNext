const KIBIBYTE_BYTES = 1024
const MEBIBYTE_BYTES = 1024 * KIBIBYTE_BYTES
const BASE64_INPUT_BYTES = 3
const BASE64_OUTPUT_BYTES = 4

export const API_REQUEST_BODY_LIMIT_BYTES = MEBIBYTE_BYTES
export const AVATAR_UPLOAD_JSON_RESERVE_BYTES = 64 * KIBIBYTE_BYTES

export interface UploadFilePolicy {
  maxBytes: number
  acceptedMimeTypes?: readonly string[]
}

export const BUNDLE_IMPORT_FILE_POLICY: UploadFilePolicy = {
  maxBytes: 16 * MEBIBYTE_BYTES,
}

export const DAE_CONFIG_IMPORT_FILE_POLICY: UploadFilePolicy = {
  maxBytes: API_REQUEST_BODY_LIMIT_BYTES,
}

export const AVATAR_UPLOAD_FILE_POLICY: UploadFilePolicy = {
  maxBytes: Math.floor(
    ((API_REQUEST_BODY_LIMIT_BYTES - AVATAR_UPLOAD_JSON_RESERVE_BYTES) * BASE64_INPUT_BYTES) / BASE64_OUTPUT_BYTES,
  ),
  acceptedMimeTypes: ['image/png', 'image/jpeg'],
}

interface UploadFileMetadata {
  size: number
  type: string
}

export type UploadFileValidation =
  | { ok: true }
  | { ok: false; reason: 'file-too-large'; maxBytes: number }
  | { ok: false; reason: 'unsupported-file-type'; acceptedMimeTypes: string[] }

export function encodedBase64Length(sourceBytes: number): number {
  return BASE64_OUTPUT_BYTES * Math.ceil(sourceBytes / BASE64_INPUT_BYTES)
}

export function validateUploadFile(file: UploadFileMetadata, policy: UploadFilePolicy): UploadFileValidation {
  if (file.size > policy.maxBytes) {
    return { ok: false, reason: 'file-too-large', maxBytes: policy.maxBytes }
  }

  if (policy.acceptedMimeTypes && !policy.acceptedMimeTypes.includes(file.type)) {
    return {
      ok: false,
      reason: 'unsupported-file-type',
      acceptedMimeTypes: [...policy.acceptedMimeTypes],
    }
  }

  return { ok: true }
}

export function formatUploadByteLimit(bytes: number): string {
  if (bytes % MEBIBYTE_BYTES === 0) {
    return `${bytes / MEBIBYTE_BYTES} MiB`
  }
  if (bytes % KIBIBYTE_BYTES === 0) {
    return `${bytes / KIBIBYTE_BYTES} KiB`
  }
  return `${bytes} bytes`
}
