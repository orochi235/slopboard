type Entry<T> = { value: T; bytes: number }

export type TextureStore<T> = {
  get(id: string): T | undefined
  /** False when the entry is larger than the whole budget; it is disposed, not held. */
  put(id: string, value: T, bytes: number): boolean
  delete(id: string): void
  clear(): void
  size(): number
  bytes(): number
}

/**
 * Byte-budgeted LRU. Generic over its value and disposal so it runs with no GL
 * context: the caller decides that disposing means `.dispose()` on a texture.
 *
 * A Map iterates in insertion order, so re-inserting on read is what makes the
 * first key the least-recently-used one.
 */
export function createTextureStore<T>(opts: {
  budgetBytes: number
  dispose?: (value: T) => void
}): TextureStore<T> {
  const held = new Map<string, Entry<T>>()
  const drop = opts.dispose ?? (() => {})
  let total = 0

  const remove = (id: string) => {
    const entry = held.get(id)
    if (!entry) return
    held.delete(id)
    total -= entry.bytes
    drop(entry.value)
  }

  return {
    get(id) {
      const entry = held.get(id)
      if (!entry) return undefined
      held.delete(id)
      held.set(id, entry)
      return entry.value
    },
    put(id, value, bytes) {
      if (bytes > opts.budgetBytes) {
        drop(value)
        return false
      }
      remove(id)
      while (total + bytes > opts.budgetBytes) {
        const oldest = held.keys().next()
        if (oldest.done) break
        remove(oldest.value)
      }
      held.set(id, { value, bytes })
      total += bytes
      return true
    },
    delete: remove,
    clear() {
      for (const id of [...held.keys()]) remove(id)
    },
    size: () => held.size,
    bytes: () => total,
  }
}
