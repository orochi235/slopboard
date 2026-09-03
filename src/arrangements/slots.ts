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

export type RankEntry = { rank: number; prevRank: number; changedAt: number }

/**
 * Rank plus the moment it last changed, which is what lets a rank change
 * animate from a pure function: depth interpolates prevRank → rank over a
 * fixed duration measured from `changedAt`. A first sighting is already
 * settled, so dropping the cache snaps to target rather than sliding in from
 * a rank the item never held.
 */
export function createRanks() {
  const held = new Map<string, RankEntry>()
  return (ids: string[], now: number): Map<string, RankEntry> => {
    const present = new Set(ids)
    for (const id of [...held.keys()]) if (!present.has(id)) held.delete(id)
    ids.forEach((id, rank) => {
      const prev = held.get(id)
      if (!prev) held.set(id, { rank, prevRank: rank, changedAt: now })
      else if (prev.rank !== rank) held.set(id, { rank, prevRank: prev.rank, changedAt: now })
    })
    return held
  }
}
