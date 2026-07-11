export interface BoundedOperationFailure {
  index: number
  error: unknown
}

export class BoundedOperationError extends Error {
  constructor(readonly failures: BoundedOperationFailure[]) {
    super(`${failures.length} bounded operation(s) failed`)
    this.name = 'BoundedOperationError'
  }
}

export async function mapWithConcurrency<Input, Output>(
  items: readonly Input[],
  concurrency: number,
  operation: (item: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive safe integer')
  }
  if (items.length === 0) return []

  const results = Array.from({ length: items.length }) as Output[]
  const failures: BoundedOperationFailure[] = []
  let nextIndex = 0

  const worker = async () => {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return

      try {
        results[index] = await operation(items[index], index)
      } catch (error) {
        failures.push({ index, error })
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  if (failures.length > 0) {
    failures.sort((left, right) => left.index - right.index)
    throw new BoundedOperationError(failures)
  }
  return results
}
