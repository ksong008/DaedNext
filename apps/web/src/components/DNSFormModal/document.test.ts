import { describe, expect, it } from 'vitest'

import { createDNSFormDocument, updateDNSFormDocumentFromCode, updateDNSFormDocumentFromSimple } from './document'

describe('dns form document', () => {
  it('keeps code text synchronized after a simple-mode edit', () => {
    const initial = createDNSFormDocument(`
upstream {
  local: 'udp://127.0.0.1:53'
}
`)

    const updated = updateDNSFormDocumentFromSimple({
      ...initial.document.parsed,
      upstreams: [
        ...initial.document.parsed.upstreams,
        { id: 'oversea', name: 'oversea', link: 'https://resolver.example/dns-query' },
      ],
    })

    expect(updated.text).toContain("local: 'udp://127.0.0.1:53'")
    expect(updated.text).toContain("oversea: 'https://resolver.example/dns-query'")
  })

  it('does not replace the simple document when code cannot be parsed', () => {
    const initial = createDNSFormDocument("upstream { local: 'udp://127.0.0.1:53' }").document
    const result = updateDNSFormDocumentFromCode(initial, 'upstream {')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.document.text).toBe('upstream {')
      expect(result.document.parsed).toBe(initial.parsed)
      expect(result.error).toBeInstanceOf(Error)
    }
  })

  it('keeps block comments and unknown directives after a simple-mode edit', () => {
    const initial = createDNSFormDocument(`
upstream {
  # local resolver
  local: 'udp://127.0.0.1:53'
}
routing {
  strategy: strict
  request {
    # request policy
    fallback: local
  }
}
`)

    const updated = updateDNSFormDocumentFromSimple({
      ...initial.document.parsed,
      requestRules: initial.document.parsed.requestRules.map((rule) => ({ ...rule, target: 'oversea' })),
    })

    expect(updated.text).toContain('  # local resolver')
    expect(updated.text).toContain('  strategy: strict')
    expect(updated.text).toContain('    # request policy')
    expect(updated.text).toContain('    fallback: oversea')
  })
})
