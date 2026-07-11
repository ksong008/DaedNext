import { describe, expect, it } from 'vitest'

import {
  API_REQUEST_BODY_LIMIT_BYTES,
  AVATAR_UPLOAD_FILE_POLICY,
  AVATAR_UPLOAD_JSON_RESERVE_BYTES,
  BUNDLE_IMPORT_FILE_POLICY,
  DAE_CONFIG_IMPORT_FILE_POLICY,
  encodedBase64Length,
  validateUploadFile,
} from './upload_policy'

describe('upload file policy', () => {
  it('keeps bundle and text imports inside their backend body contracts', () => {
    expect(BUNDLE_IMPORT_FILE_POLICY.maxBytes).toBe(16 * 1024 * 1024)
    expect(DAE_CONFIG_IMPORT_FILE_POLICY.maxBytes).toBe(API_REQUEST_BODY_LIMIT_BYTES)
  })

  it('accepts a file at the configured ceiling and rejects one byte over it', () => {
    expect(
      validateUploadFile(
        { size: DAE_CONFIG_IMPORT_FILE_POLICY.maxBytes, type: 'text/plain' },
        DAE_CONFIG_IMPORT_FILE_POLICY,
      ),
    ).toEqual({ ok: true })
    expect(
      validateUploadFile(
        { size: DAE_CONFIG_IMPORT_FILE_POLICY.maxBytes + 1, type: 'text/plain' },
        DAE_CONFIG_IMPORT_FILE_POLICY,
      ),
    ).toEqual({
      ok: false,
      reason: 'file-too-large',
      maxBytes: DAE_CONFIG_IMPORT_FILE_POLICY.maxBytes,
    })
  })

  it('rejects avatar MIME types outside PNG and JPEG before reading the file', () => {
    expect(validateUploadFile({ size: 1, type: 'image/webp' }, AVATAR_UPLOAD_FILE_POLICY)).toEqual({
      ok: false,
      reason: 'unsupported-file-type',
      acceptedMimeTypes: ['image/png', 'image/jpeg'],
    })
    expect(validateUploadFile({ size: 1, type: 'image/jpeg' }, AVATAR_UPLOAD_FILE_POLICY)).toEqual({ ok: true })
  })

  it('reserves enough request space for avatar base64 and the profile JSON envelope', () => {
    expect(
      encodedBase64Length(AVATAR_UPLOAD_FILE_POLICY.maxBytes) + AVATAR_UPLOAD_JSON_RESERVE_BYTES,
    ).toBeLessThanOrEqual(API_REQUEST_BODY_LIMIT_BYTES)
  })
})
