/**
 * Stable per-item positions, which pure `arrange` calls cannot derive on their
 * own: any index into a sorted list shifts when an item arrives (sort newest
 * first) or expires (sort oldest first), so every neighbour jumps. Both helpers
 * are the caches the Arrangement contract allows — dropping one costs a single
 * reshuffle, never correctness.
 */

/** Lowest free slot, reused after expiry. For fixed grids. */
export function createSlots() {
  const held = new Map<string, number>()
  return (ids: string[]): Map<string, number> => {
    const present = new Set(ids)
    for (const id of [...held.keys()]) if (!present.has(id)) held.delete(id)
    const used = new Set(held.values())
    let next = 0
    for (const id of ids) {
      if (held.has(id)) continue
      while (used.has(next)) next++
      held.set(id, next)
      used.add(next)
    }
    return held
  }
}

/** Monotonic, never reused. Keeps consecutive arrivals apart. */
export function createSequencer() {
  const held = new Map<string, number>()
  let next = 0
  return (ids: string[]): Map<string, number> => {
    const present = new Set(ids)
    for (const id of [...held.keys()]) if (!present.has(id)) held.delete(id)
    for (const id of ids) if (!held.has(id)) held.set(id, next++)
    return held
  }
}

export const ramp = (v: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (v - a) / (b - a)))
