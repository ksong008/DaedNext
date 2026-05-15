export interface NodeProtocolParts {
  protocol?: string
  transport?: string
}

export function formatNodeProtocolParts(protocol?: string | null, transport?: string | null): NodeProtocolParts | null {
  const normalizedProtocol = protocol?.trim()
  const normalizedTransport = transport?.trim()

  if (!normalizedProtocol && !normalizedTransport) {
    return null
  }

  if (!normalizedProtocol) {
    return { transport: normalizedTransport }
  }

  if (!normalizedTransport || normalizedTransport.toLowerCase() === normalizedProtocol.toLowerCase()) {
    return { protocol: normalizedProtocol }
  }

  return {
    protocol: normalizedProtocol,
    transport: normalizedTransport,
  }
}

export function formatNodeProtocolLabel(protocol?: string | null, transport?: string | null): string | null {
  const parts = formatNodeProtocolParts(protocol, transport)
  if (!parts) return null
  return [parts.protocol, parts.transport].filter(Boolean).join(' ')
}
