/** A closed interval of wall-clock time. Null is no filter at all. */
export type Range = { from: number; to: number }

/** What the band holds: a fixed interval, or the last `last` ms, which moves
 *  with the clock. Stored as timestamps, a window ending now would fall behind
 *  now and slide left along the growing axis. */
export type Filter = Range | { last: number }

export const resolve = (filter: Filter | null, now: number): Range | null =>
  filter === null ? null : 'last' in filter ? { from: now - filter.last, to: now } : filter

/** A drag's result. `span.to` is a render old by the time the thumb lands, so
 *  within one step of it counts as the end. */
export const filterFrom = (from: number, to: number, span: Range, step: number): Filter =>
  to >= span.to - step ? { last: span.to - from } : { from, to }

export function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

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

export const bucketRange = (key: BucketKey): Filter => ({
  last: BUCKETS.find((b) => b.key === key)?.ms ?? HOUR,
})

/** Lengths the axis rounds up to. An axis ending at the oldest artifact
 *  rescales every tick, and every thumb on it creeps with the scale. */
const EXTENTS = [15 * MINUTE, 30 * MINUTE, HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 3 * DAY, 7 * DAY, 30 * DAY]

/** The axis the band draws: back far enough to hold the oldest artifact, to
 *  now. An empty wall gets an hour, because a zero-width axis has no thumbs to
 *  drag. */
export function spanOf(bornAts: readonly number[], now: number): Range {
  let oldest = Infinity
  for (const t of bornAts) if (t < oldest) oldest = t
  if (!Number.isFinite(oldest)) return { from: now - HOUR, to: now }
  const age = now - oldest
  const extent = EXTENTS.find((e) => e >= age) ?? Math.ceil(age / (30 * DAY)) * 30 * DAY
  return { from: now - extent, to: now }
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
