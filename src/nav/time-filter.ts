/** A closed interval of wall-clock time. Null is no filter at all. */
export type Range = { from: number; to: number }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The named spans the band offers as one click, all ending now. Every one is
 *  reachable by dragging too — these are shortcuts, not the only answers. */
export const BUCKETS = [
  { key: 'hour', label: 'last hour', ms: HOUR },
  { key: 'today', label: 'today', ms: DAY },
  { key: 'week', label: 'this week', ms: 7 * DAY },
] as const

export type BucketKey = (typeof BUCKETS)[number]['key']

export const bucketRange = (key: BucketKey, now: number): Range => ({
  from: now - (BUCKETS.find((b) => b.key === key)?.ms ?? HOUR),
  to: now,
})

/** The axis the band draws: oldest artifact on the wall, to now. An empty wall
 *  gets an hour, because a zero-width axis has no thumbs to drag. */
export function spanOf(bornAts: readonly number[], now: number): Range {
  let oldest = Infinity
  for (const t of bornAts) if (t < oldest) oldest = t
  return { from: Number.isFinite(oldest) ? oldest : now - HOUR, to: now }
}

/** How many artifacts landed in each slice of the span. */
export function histogram(bornAts: readonly number[], span: Range, bins: number): number[] {
  const out = new Array<number>(bins).fill(0)
  const width = span.to - span.from
  if (width <= 0) return out
  for (const t of bornAts) {
    if (t < span.from || t > span.to) continue
    // The artifact landing exactly at `to` belongs to the last bin rather than
    // to a bin past the end.
    const i = Math.min(bins - 1, Math.floor(((t - span.from) / width) * bins))
    out[i] = (out[i] ?? 0) + 1
  }
  return out
}

export const keptBy = (bornAt: number, range: Range | null): boolean =>
  range === null || (bornAt >= range.from && bornAt <= range.to)
