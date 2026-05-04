import type {
  DAEBundle,
  DAEBundleConfig,
  DAEBundleDNS,
  DAEBundleGroup,
  DAEBundleNode,
  DAEBundleRouting,
  DAEBundleSubscription,
} from '~/apis/types'

export type BundleCollectionKey = 'configs' | 'dnss' | 'routings' | 'subscriptions' | 'nodes' | 'groups'

export interface BundleChangedDetail {
  label: string
  changes: string[]
}

export interface BundleCollectionDiff {
  key: BundleCollectionKey
  added: string[]
  removed: string[]
  changed: string[]
  changedDetails: BundleChangedDetail[]
}

export interface BundleChoiceDiff {
  current: string | null
  incoming: string | null
  changed: boolean
}

export interface BundleDiffPreview {
  collections: BundleCollectionDiff[]
  mode: BundleChoiceDiff
  defaults: {
    config: BundleChoiceDiff
    dns: BundleChoiceDiff
    routing: BundleChoiceDiff
    group: BundleChoiceDiff
  }
  selected: {
    config: BundleChoiceDiff
    dns: BundleChoiceDiff
    routing: BundleChoiceDiff
  }
  hasChanges: boolean
}

function sortStrings(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function compareCollections<T>(
  key: BundleCollectionKey,
  currentItems: T[],
  incomingItems: T[],
  identity: (item: T) => string,
  label: (item: T) => string,
  currentSignature: (item: T) => string,
  incomingSignature: (item: T) => string,
  describeChanges: (currentItem: T, incomingItem: T) => string[],
): BundleCollectionDiff {
  const currentMap = new Map(currentItems.map((item) => [identity(item), item]))
  const incomingMap = new Map(incomingItems.map((item) => [identity(item), item]))

  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  const changedDetails: BundleChangedDetail[] = []

  for (const [id, item] of incomingMap) {
    const currentItem = currentMap.get(id)
    if (!currentItem) {
      added.push(label(item))
      continue
    }
    if (currentSignature(currentItem) !== incomingSignature(item)) {
      const itemLabel = label(item)
      changed.push(itemLabel)
      changedDetails.push({
        label: itemLabel,
        changes: describeChanges(currentItem, item),
      })
    }
  }

  for (const [id, item] of currentMap) {
    if (!incomingMap.has(id)) {
      removed.push(label(item))
    }
  }

  return {
    key,
    added: sortStrings(added),
    removed: sortStrings(removed),
    changed: sortStrings(changed),
    changedDetails: changedDetails.sort((a, b) => a.label.localeCompare(b.label)),
  }
}

function configLabel(item: DAEBundleConfig) {
  return item.name
}

function dnsLabel(item: DAEBundleDNS) {
  return item.name
}

function routingLabel(item: DAEBundleRouting) {
  return item.name
}

function subscriptionLabel(item: DAEBundleSubscription) {
  return item.tag?.trim() || item.link
}

function nodeLabel(item: DAEBundleNode) {
  return item.tag?.trim() || item.name?.trim() || item.link
}

function groupLabel(item: DAEBundleGroup) {
  return item.name
}

function subscriptionLabelMap(bundle: DAEBundle) {
  return new Map(bundle.subscriptions.map((item) => [item.id, subscriptionLabel(item)]))
}

function nodeLabelMap(bundle: DAEBundle) {
  return new Map(bundle.nodes.map((item) => [item.id, nodeLabel(item)]))
}

function configChoice(bundle: DAEBundle, id?: number) {
  if (id == null) return null
  return bundle.configs.find((item) => item.id === id)?.name ?? `#${id}`
}

function dnsChoice(bundle: DAEBundle, id?: number) {
  if (id == null) return null
  return bundle.dnss.find((item) => item.id === id)?.name ?? `#${id}`
}

function routingChoice(bundle: DAEBundle, id?: number) {
  if (id == null) return null
  return bundle.routings.find((item) => item.id === id)?.name ?? `#${id}`
}

function groupChoice(bundle: DAEBundle, id?: number) {
  if (id == null) return null
  return bundle.groups.find((item) => item.id === id)?.name ?? `#${id}`
}

function signatureJSON(value: unknown) {
  return JSON.stringify(value)
}

function tokenizeSection(source: string) {
  return source
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseSectionEntries(source: string, rootName: string) {
  const tokens = tokenizeSection(source)
  const stack: string[] = []
  const ruleIndex = new Map<string, number>()
  const entries = new Map<string, string>()

  for (const token of tokens) {
    if (token === '}') {
      stack.pop()
      continue
    }
    if (token.endsWith('{')) {
      const sectionName = token.slice(0, -1).trim()
      if (sectionName) {
        stack.push(sectionName)
      }
      continue
    }

    const pathPrefix = stack.join('.')
    const normalizedPrefix =
      pathPrefix === rootName
        ? ''
        : pathPrefix.startsWith(`${rootName}.`)
          ? pathPrefix.slice(rootName.length + 1)
          : pathPrefix

    const colonIndex = token.indexOf(':')
    if (colonIndex > 0) {
      const key = token.slice(0, colonIndex).trim()
      const value = token.slice(colonIndex + 1).trim()
      const path = [normalizedPrefix, key].filter(Boolean).join('.')
      entries.set(path, value)
      continue
    }

    const ruleKey = normalizedPrefix || rootName
    const nextIndex = ruleIndex.get(ruleKey) ?? 0
    ruleIndex.set(ruleKey, nextIndex + 1)
    const path = [normalizedPrefix, `rule[${nextIndex}]`].filter(Boolean).join('.')
    entries.set(path, token)
  }

  return entries
}

function normalizeSectionLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && line !== '{' && line !== '}')
}

function diffTextLines(current: string, incoming: string) {
  const currentLines = new Set(normalizeSectionLines(current))
  const incomingLines = new Set(normalizeSectionLines(incoming))
  const removed = [...currentLines].filter((line) => !incomingLines.has(line)).sort((a, b) => a.localeCompare(b))
  const added = [...incomingLines].filter((line) => !currentLines.has(line)).sort((a, b) => a.localeCompare(b))
  const changes = [...removed.map((line) => `- ${line}`), ...added.map((line) => `+ ${line}`)]
  return changes.length > 0 ? changes : ['section content changed']
}

function diffSectionEntries(current: string, incoming: string, rootName: string) {
  const currentEntries = parseSectionEntries(current, rootName)
  const incomingEntries = parseSectionEntries(incoming, rootName)
  const paths = new Set([...currentEntries.keys(), ...incomingEntries.keys()])

  if (paths.size === 0) {
    return diffTextLines(current, incoming)
  }

  const changes: string[] = []
  for (const path of [...paths].sort((a, b) => a.localeCompare(b))) {
    const currentValue = currentEntries.get(path)
    const incomingValue = incomingEntries.get(path)
    if (currentValue === incomingValue) {
      continue
    }
    if (currentValue == null) {
      changes.push(`+ ${path}: ${incomingValue}`)
      continue
    }
    if (incomingValue == null) {
      changes.push(`- ${path}: ${currentValue}`)
      continue
    }
    changes.push(`${path}: ${currentValue} -> ${incomingValue}`)
  }

  return changes.length > 0 ? changes : diffTextLines(current, incoming)
}

function diffField<T>(label: string, current: T, incoming: T): string | null {
  return current === incoming ? null : `${label}: ${String(current)} -> ${String(incoming)}`
}

function arrayDiff(label: string, current: string[], incoming: string[]) {
  const currentSet = new Set(current)
  const incomingSet = new Set(incoming)
  const removed = current.filter((item) => !incomingSet.has(item)).sort((a, b) => a.localeCompare(b))
  const added = incoming.filter((item) => !currentSet.has(item)).sort((a, b) => a.localeCompare(b))
  if (removed.length === 0 && added.length === 0) return null
  return `${label}: -[${removed.join(', ')}] +[${added.join(', ')}]`
}

function keyValList(values: { key?: string | null; val: string }[]) {
  return values
    .map((item) => `${item.key ?? ''}:${item.val}`)
    .sort((a, b) => a.localeCompare(b))
}

function groupSignature(bundle: DAEBundle, item: DAEBundleGroup) {
  const subs = subscriptionLabelMap(bundle)
  const nodes = nodeLabelMap(bundle)
  return signatureJSON({
    name: item.name,
    policy: item.policy,
    policyParams: [...item.policyParams].map((param) => ({ key: param.key ?? null, val: param.val })).sort((a, b) => {
      const ak = `${a.key ?? ''}:${a.val}`
      const bk = `${b.key ?? ''}:${b.val}`
      return ak.localeCompare(bk)
    }),
    nodeLabels: item.nodeIds.map((id) => nodes.get(id) ?? `#${id}`).sort((a, b) => a.localeCompare(b)),
    subscriptionBindings: item.subscriptionBindings
      .map((binding) => ({
        subscription: subs.get(binding.subscriptionId) ?? `#${binding.subscriptionId}`,
        regex: binding.nameFilterRegex ?? null,
      }))
      .sort((a, b) => `${a.subscription}:${a.regex ?? ''}`.localeCompare(`${b.subscription}:${b.regex ?? ''}`)),
  })
}

function nodeSignature(bundle: DAEBundle, item: DAEBundleNode) {
  const subs = subscriptionLabelMap(bundle)
  return signatureJSON({
    link: item.link,
    name: item.name,
    address: item.address,
    protocol: item.protocol,
    tag: item.tag ?? null,
    subscription: item.subscriptionId != null ? subs.get(item.subscriptionId) ?? `#${item.subscriptionId}` : null,
  })
}

function choiceDiff(current: string | null, incoming: string | null): BundleChoiceDiff {
  return {
    current,
    incoming,
    changed: current !== incoming,
  }
}

export function createBundleDiffPreview(current: DAEBundle, incoming: DAEBundle): BundleDiffPreview {
  const collections: BundleCollectionDiff[] = [
    compareCollections('configs', current.configs, incoming.configs, (item) => item.name, configLabel, (item) =>
      signatureJSON({ name: item.name, global: item.global }),
      (item) => signatureJSON({ name: item.name, global: item.global }),
      (currentItem, incomingItem) => diffSectionEntries(currentItem.global, incomingItem.global, 'global'),
    ),
    compareCollections('dnss', current.dnss, incoming.dnss, (item) => item.name, dnsLabel, (item) =>
      signatureJSON({ name: item.name, dns: item.dns }),
      (item) => signatureJSON({ name: item.name, dns: item.dns }),
      (currentItem, incomingItem) => diffSectionEntries(currentItem.dns, incomingItem.dns, 'dns'),
    ),
    compareCollections('routings', current.routings, incoming.routings, (item) => item.name, routingLabel, (item) =>
      signatureJSON({ name: item.name, routing: item.routing }),
      (item) => signatureJSON({ name: item.name, routing: item.routing }),
      (currentItem, incomingItem) => diffSectionEntries(currentItem.routing, incomingItem.routing, 'routing'),
    ),
    compareCollections('subscriptions', current.subscriptions, incoming.subscriptions, (item) => item.tag?.trim() || item.link, subscriptionLabel, (item) =>
      signatureJSON({
        tag: item.tag ?? null,
        link: item.link,
        cronExp: item.cronExp,
        cronEnable: item.cronEnable,
        status: item.status,
        info: item.info,
      }),
      (item) =>
        signatureJSON({
          tag: item.tag ?? null,
          link: item.link,
          cronExp: item.cronExp,
          cronEnable: item.cronEnable,
          status: item.status,
          info: item.info,
        }),
      (currentItem, incomingItem) =>
        [
          diffField('link', currentItem.link, incomingItem.link),
          diffField('cronExp', currentItem.cronExp, incomingItem.cronExp),
          diffField('cronEnable', currentItem.cronEnable, incomingItem.cronEnable),
          diffField('status', currentItem.status, incomingItem.status),
          diffField('info', currentItem.info, incomingItem.info),
          diffField('tag', currentItem.tag ?? '', incomingItem.tag ?? ''),
        ].filter((item): item is string => Boolean(item)),
    ),
    compareCollections('nodes', current.nodes, incoming.nodes, (item) => item.tag?.trim() || item.link, nodeLabel, (item) =>
      nodeSignature(current, item),
      (item) => nodeSignature(incoming, item),
      (currentItem, incomingItem) =>
        [
          diffField('link', currentItem.link, incomingItem.link),
          diffField('name', currentItem.name, incomingItem.name),
          diffField('address', currentItem.address, incomingItem.address),
          diffField('protocol', currentItem.protocol, incomingItem.protocol),
          diffField('tag', currentItem.tag ?? '', incomingItem.tag ?? ''),
          diffField('subscriptionId', currentItem.subscriptionId ?? '', incomingItem.subscriptionId ?? ''),
        ].filter((item): item is string => Boolean(item)),
    ),
    compareCollections('groups', current.groups, incoming.groups, (item) => item.name, groupLabel, (item) =>
      groupSignature(current, item),
      (item) => groupSignature(incoming, item),
      (currentItem, incomingItem) =>
        [
          diffField('policy', currentItem.policy, incomingItem.policy),
          arrayDiff('policyParams', keyValList(currentItem.policyParams), keyValList(incomingItem.policyParams)),
          arrayDiff('nodeIds', currentItem.nodeIds.map(String), incomingItem.nodeIds.map(String)),
          arrayDiff(
            'subscriptionBindings',
            currentItem.subscriptionBindings.map((item) => `${item.subscriptionId}:${item.nameFilterRegex ?? ''}`),
            incomingItem.subscriptionBindings.map((item) => `${item.subscriptionId}:${item.nameFilterRegex ?? ''}`),
          ),
        ].filter((item): item is string => Boolean(item)),
    ),
  ]

  const mode = choiceDiff(current.mode || null, incoming.mode || null)
  const defaults = {
    config: choiceDiff(configChoice(current, current.defaults.configId), configChoice(incoming, incoming.defaults.configId)),
    dns: choiceDiff(dnsChoice(current, current.defaults.dnsId), dnsChoice(incoming, incoming.defaults.dnsId)),
    routing: choiceDiff(
      routingChoice(current, current.defaults.routingId),
      routingChoice(incoming, incoming.defaults.routingId),
    ),
    group: choiceDiff(groupChoice(current, current.defaults.groupId), groupChoice(incoming, incoming.defaults.groupId)),
  }
  const selected = {
    config: choiceDiff(configChoice(current, current.selected.configId), configChoice(incoming, incoming.selected.configId)),
    dns: choiceDiff(dnsChoice(current, current.selected.dnsId), dnsChoice(incoming, incoming.selected.dnsId)),
    routing: choiceDiff(
      routingChoice(current, current.selected.routingId),
      routingChoice(incoming, incoming.selected.routingId),
    ),
  }

  const hasCollectionChanges = collections.some(
    (collection) => collection.added.length > 0 || collection.removed.length > 0 || collection.changed.length > 0,
  )
  const hasChoiceChanges =
    mode.changed ||
    defaults.config.changed ||
    defaults.dns.changed ||
    defaults.routing.changed ||
    defaults.group.changed ||
    selected.config.changed ||
    selected.dns.changed ||
    selected.routing.changed

  return {
    collections,
    mode,
    defaults,
    selected,
    hasChanges: hasCollectionChanges || hasChoiceChanges,
  }
}
