const NODE_ID_HASH_OFFSET_BASIS = 2_166_136_261
const NODE_ID_HASH_PRIME = 16_777_619
const NODE_ID_SEPARATOR = 0

export const SUBSCRIPTION_NODE_INITIAL_WINDOW_SIZE = 64
export const SUBSCRIPTION_NODE_WINDOW_INCREMENT = 64

export function nextSubscriptionNodeWindowSize(currentSize: number, totalNodes: number): number {
  const boundedCurrentSize = Math.max(0, Math.floor(currentSize))
  const boundedTotalNodes = Math.max(0, Math.floor(totalNodes))
  return Math.min(boundedTotalNodes, boundedCurrentSize + SUBSCRIPTION_NODE_WINDOW_INCREMENT)
}

function hashNodeIds(nodeIds: readonly string[]): string {
  let hash = NODE_ID_HASH_OFFSET_BASIS
  for (const nodeId of nodeIds) {
    for (let index = 0; index < nodeId.length; index++) {
      hash = Math.imul(hash ^ nodeId.charCodeAt(index), NODE_ID_HASH_PRIME)
    }
    hash = Math.imul(hash ^ NODE_ID_SEPARATOR, NODE_ID_HASH_PRIME)
  }
  return (hash >>> 0).toString(36)
}

export function createSubscriptionNodeWindowKey(
  subscriptionId: string,
  revision: string,
  nodeIds: readonly string[],
): string {
  return `${subscriptionId}:${revision}:${nodeIds.length}:${hashNodeIds(nodeIds)}`
}
