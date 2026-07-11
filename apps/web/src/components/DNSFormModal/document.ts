import type { DNSConfig } from './types'

import { generateDNSConfig, parseDNSConfig } from './parser'

const EMPTY_DNS_CONFIG: DNSConfig = {
  upstreams: [],
  requestRules: [],
  responseRules: [],
  others: '',
}

export interface DNSFormDocument {
  text: string
  parsed: DNSConfig
}

export type InitialDNSFormDocument =
  | { document: DNSFormDocument; mode: 'simple'; error?: undefined }
  | { document: DNSFormDocument; mode: 'code'; error: Error }

export type SynchronizedDNSFormDocument =
  | { document: DNSFormDocument; ok: true; error?: undefined }
  | { document: DNSFormDocument; ok: false; error: Error }

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

export function createDNSFormDocument(text: string): InitialDNSFormDocument {
  try {
    return {
      document: { text, parsed: parseDNSConfig(text) },
      mode: 'simple',
    }
  } catch (error) {
    return {
      document: { text, parsed: EMPTY_DNS_CONFIG },
      mode: 'code',
      error: asError(error),
    }
  }
}

export function updateDNSFormDocumentFromSimple(parsed: DNSConfig): DNSFormDocument {
  return {
    parsed,
    text: generateDNSConfig(parsed),
  }
}

export function editDNSFormDocumentCode(document: DNSFormDocument, text: string): DNSFormDocument {
  return { ...document, text }
}

export function updateDNSFormDocumentFromCode(
  document: DNSFormDocument,
  text = document.text,
): SynchronizedDNSFormDocument {
  const editedDocument = editDNSFormDocumentCode(document, text)
  try {
    return {
      document: { text, parsed: parseDNSConfig(text) },
      ok: true,
    }
  } catch (error) {
    return {
      document: editedDocument,
      ok: false,
      error: asError(error),
    }
  }
}
