import type { DNSConfig, DNSPreservedLines, RoutingRule, Upstream } from './types'

const UPSTREAM_LINE_RE = /^([\w.-]+):\s*(?:'([^']*)'|"([^"]*)"|(\S+))\s*$/
const WORD_CHARACTER_RE = /[\w.-]/
const WHITESPACE_CHARACTER_RE = /\s/

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

interface ExtractedBlock {
  inner: string
  full: string
}

interface SplitLine {
  code: string
  comment?: string
}

function findBlockStart(source: string, blockName: string): { blockStart: number; innerStart: number } | undefined {
  let quote: "'" | '"' | null = null
  let escaped = false
  let comment = false

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (comment) {
      if (character === '\n') comment = false
      continue
    }
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '#') {
      comment = true
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (!source.startsWith(blockName, index)) continue

    const previousCharacter = index > 0 ? source[index - 1] : ''
    const afterNameIndex = index + blockName.length
    const nextCharacter = source[afterNameIndex] ?? ''
    if ((previousCharacter && WORD_CHARACTER_RE.test(previousCharacter)) || WORD_CHARACTER_RE.test(nextCharacter)) {
      continue
    }

    let braceIndex = afterNameIndex
    while (WHITESPACE_CHARACTER_RE.test(source[braceIndex] ?? '')) braceIndex++
    if (source[braceIndex] === '{') {
      return { blockStart: index, innerStart: braceIndex + 1 }
    }
  }
}

function extractBlock(source: string, blockName: string): ExtractedBlock | undefined {
  const start = findBlockStart(source, blockName)
  if (!start) return

  const startIndex = start.innerStart
  let depth = 1
  let quote: "'" | '"' | null = null
  let escaped = false
  let comment = false
  let index = startIndex

  for (; index < source.length; index++) {
    const character = source[index]

    if (comment) {
      if (character === '\n') comment = false
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '#') {
      comment = true
    } else if (character === "'" || character === '"') {
      quote = character
    } else if (character === '{') {
      depth++
    } else if (character === '}') {
      depth--
      if (depth === 0) break
    }
  }

  if (depth !== 0) {
    throw new Error(`Unclosed ${blockName} block`)
  }

  return {
    inner: source.slice(startIndex, index).trim(),
    full: source.slice(start.blockStart, index + 1),
  }
}

function splitInlineComment(line: string): SplitLine {
  let quote: "'" | '"' | null = null
  let escaped = false

  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
    } else if (character === '#') {
      return {
        code: line.slice(0, index).trim(),
        comment: line.slice(index).trim(),
      }
    }
  }

  return { code: line.trim() }
}

function collectPreservedLines(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseUpstreamBlock(source: string, upstreams: Upstream[], preserved: string[]): void {
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const { code, comment } = splitInlineComment(trimmed)
    if (!code) {
      if (comment) preserved.push(comment)
      continue
    }

    const match = code.match(UPSTREAM_LINE_RE)
    const link = match?.[2] ?? match?.[3] ?? match?.[4]
    if (!match || link == null) {
      preserved.push(trimmed)
      continue
    }

    upstreams.push({ id: generateId(), name: match[1], link })
    if (comment) preserved.push(comment)
  }
}

function parseRoutingBlock(source: string, rules: RoutingRule[], preserved: string[]): void {
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const { code, comment } = splitInlineComment(trimmed)
    if (!code) {
      if (comment) preserved.push(comment)
      continue
    }

    const colonIndex = code.indexOf(':')
    const fallbackTarget =
      colonIndex >= 0 && code.slice(0, colonIndex).trim() === 'fallback' ? code.slice(colonIndex + 1).trim() : ''
    if (fallbackTarget) {
      rules.push({ id: generateId(), matcher: 'fallback', target: fallbackTarget })
      if (comment) preserved.push(comment)
      continue
    }

    const arrowIndex = code.indexOf('->')
    const matcher = arrowIndex >= 0 ? code.slice(0, arrowIndex).trim() : ''
    const target = arrowIndex >= 0 ? code.slice(arrowIndex + 2).trim() : ''
    if (matcher && target && !code.slice(arrowIndex + 2).includes('->')) {
      rules.push({ id: generateId(), matcher, target })
      if (comment) preserved.push(comment)
      continue
    }

    preserved.push(trimmed)
  }
}

function appendPreservedLines(lines: readonly string[], indentation: string): string {
  return lines.map((line) => `${indentation}${line.trim()}\n`).join('')
}

export function parseDNSConfig(config: string): DNSConfig {
  const upstreams: Upstream[] = []
  const requestRules: RoutingRule[] = []
  const responseRules: RoutingRule[] = []
  const preserved: DNSPreservedLines = {
    upstream: [],
    routing: [],
    request: [],
    response: [],
  }

  let content = config.trim()
  let others = content
  const outerDNSBlock = extractBlock(content, 'dns')
  if (outerDNSBlock?.full.trim() === content) {
    content = outerDNSBlock.inner
    others = content
  }

  const upstreamBlock = extractBlock(content, 'upstream')
  if (upstreamBlock) {
    parseUpstreamBlock(upstreamBlock.inner, upstreams, preserved.upstream)
    others = others.replace(upstreamBlock.full, '')
  }

  const routingBlock = extractBlock(content, 'routing')
  if (routingBlock) {
    let routingRemainder = routingBlock.inner
    const requestBlock = extractBlock(routingBlock.inner, 'request')
    const responseBlock = extractBlock(routingBlock.inner, 'response')

    if (requestBlock) {
      parseRoutingBlock(requestBlock.inner, requestRules, preserved.request)
      routingRemainder = routingRemainder.replace(requestBlock.full, '')
    }
    if (responseBlock) {
      parseRoutingBlock(responseBlock.inner, responseRules, preserved.response)
      routingRemainder = routingRemainder.replace(responseBlock.full, '')
    }

    preserved.routing = collectPreservedLines(routingRemainder)
    others = others.replace(routingBlock.full, '')
  }

  return { upstreams, requestRules, responseRules, others: others.trim(), preserved }
}

export function generateDNSConfig(config: DNSConfig): string {
  let result = ''
  const preserved = config.preserved ?? { upstream: [], routing: [], request: [], response: [] }

  if (config.others) {
    result += `${config.others.trim()}\n\n`
  }

  if (config.upstreams.length > 0 || preserved.upstream.length > 0) {
    result += 'upstream {\n'
    result += appendPreservedLines(preserved.upstream, '  ')
    for (const upstream of config.upstreams) {
      result += `  ${upstream.name}: '${upstream.link}'\n`
    }
    result += '}\n\n'
  }

  const hasRequestBlock = config.requestRules.length > 0 || preserved.request.length > 0
  const hasResponseBlock = config.responseRules.length > 0 || preserved.response.length > 0
  if (hasRequestBlock || hasResponseBlock || preserved.routing.length > 0) {
    result += 'routing {\n'
    result += appendPreservedLines(preserved.routing, '  ')

    if (hasRequestBlock) {
      result += '  request {\n'
      result += appendPreservedLines(preserved.request, '    ')
      for (const rule of config.requestRules) {
        result +=
          rule.matcher === 'fallback' ? `    fallback: ${rule.target}\n` : `    ${rule.matcher} -> ${rule.target}\n`
      }
      result += '  }\n'
    }

    if (hasResponseBlock) {
      result += '  response {\n'
      result += appendPreservedLines(preserved.response, '    ')
      for (const rule of config.responseRules) {
        result +=
          rule.matcher === 'fallback' ? `    fallback: ${rule.target}\n` : `    ${rule.matcher} -> ${rule.target}\n`
      }
      result += '  }\n'
    }

    result += '}\n'
  }

  return result.trimEnd()
}
