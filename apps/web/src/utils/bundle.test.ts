import { describe, expect, it } from 'vitest'

import { Policy, type DAEBundle } from '~/apis/types'

import { createBundleDiffPreview } from './bundle'

function makeBundle(overrides?: Partial<DAEBundle>): DAEBundle {
  return {
    schemaVersion: 1,
    exportedAt: '2026-05-04T00:00:00.000Z',
    mode: 'rule',
    defaults: { configId: 1, dnsId: 1, routingId: 1, groupId: 1 },
    selected: { configId: 1, dnsId: 1, routingId: 1 },
    configs: [{ id: 1, name: 'cfg', global: 'global { log_level: info }' }],
    dnss: [{ id: 1, name: 'dns', dns: 'dns {}' }],
    routings: [{ id: 1, name: 'routing', routing: 'routing {}' }],
    subscriptions: [
      {
        id: 1,
        updatedAt: '2026-05-04T00:00:00.000Z',
        link: 'https://example.invalid/sub',
        cronExp: '10 */6 * * *',
        cronEnable: true,
        status: 'ok',
        info: 'info',
        tag: 'sub',
      },
    ],
    nodes: [{ id: 1, link: 'ss://node', name: 'node', address: '127.0.0.1', protocol: 'ss', subscriptionId: 1 }],
    groups: [
      {
        id: 1,
        name: 'proxy',
        policy: Policy.Fixed,
        policyParams: [{ key: 'index', val: '0' }],
        nodeIds: [1],
        subscriptionBindings: [{ subscriptionId: 1, nameFilterRegex: '^HK' }],
      },
    ],
    ...overrides,
  }
}

describe('createBundleDiffPreview', () => {
  it('detects collection and selection differences', () => {
    const current = makeBundle()
    const incoming = makeBundle({
      mode: 'global',
      defaults: { configId: 2, dnsId: 1, routingId: 1, groupId: 1 },
      selected: { configId: 2, dnsId: 1, routingId: 1 },
      configs: [
        { id: 2, name: 'cfg', global: 'global { log_level: warn }' },
        { id: 3, name: 'cfg-new', global: 'global {}' },
      ],
      nodes: [{ id: 9, link: 'ss://node', name: 'node', address: '127.0.0.2', protocol: 'ss', subscriptionId: 1 }],
    })

    const preview = createBundleDiffPreview(current, incoming)

    expect(preview.hasChanges).toBe(true)
    expect(preview.mode.changed).toBe(true)

    const configDiff = preview.collections.find((item) => item.key === 'configs')
    expect(configDiff?.added).toContain('cfg-new')
    expect(configDiff?.changed).toContain('cfg')
    expect(configDiff?.changedDetails[0]?.changes.some((item) => item.includes('log_level') && item.includes('->'))).toBe(
      true,
    )

    const nodeDiff = preview.collections.find((item) => item.key === 'nodes')
    expect(nodeDiff?.changed).toContain('node')
    expect(nodeDiff?.changedDetails[0]?.changes.some((item) => item.includes('address'))).toBe(true)
  })

  it('reports no changes for identical bundles', () => {
    const current = makeBundle()
    const preview = createBundleDiffPreview(current, makeBundle())

    expect(preview.hasChanges).toBe(false)
    expect(preview.collections.every((item) => item.added.length === 0 && item.removed.length === 0 && item.changed.length === 0)).toBe(true)
  })
})
