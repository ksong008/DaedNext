import { describe, expect, it } from 'vitest'

import {
  createSubscriptionNodeWindowKey,
  nextSubscriptionNodeWindowSize,
  SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE,
  SUBSCRIPTION_NODE_WINDOW_INCREMENT,
} from './subscription_node_window'

describe('subscription node progressive window', () => {
  it('grows by a bounded increment and stops at the node count', () => {
    const total = SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE + SUBSCRIPTION_NODE_WINDOW_INCREMENT + 7

    const secondWindow = nextSubscriptionNodeWindowSize(SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE, total)
    expect(secondWindow).toBe(SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE + SUBSCRIPTION_NODE_WINDOW_INCREMENT)
    expect(nextSubscriptionNodeWindowSize(secondWindow, total)).toBe(total)
    expect(nextSubscriptionNodeWindowSize(total, total)).toBe(total)
  })

  it('changes the component key when node identity changes at the same length', () => {
    const first = createSubscriptionNodeWindowKey('7', '2026-07-11T00:00:00Z', ['1', '2', '3'])
    const second = createSubscriptionNodeWindowKey('7', '2026-07-11T00:00:00Z', ['1', '9', '3'])

    expect(first).not.toBe(second)
  })

  it('changes the component key when the subscription revision changes', () => {
    const first = createSubscriptionNodeWindowKey('7', 'before', ['1'])
    const second = createSubscriptionNodeWindowKey('7', 'after', ['1'])

    expect(first).not.toBe(second)
  })
})
