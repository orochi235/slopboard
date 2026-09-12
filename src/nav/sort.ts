import { emphasisAt, type Level } from '@shared/attention.ts'
import type { WallItem } from '@shared/protocol.ts'

/** What the band offers. One key orders the zones on the wall and the
 *  sidebar's flag list together, so the two can never disagree about what is
 *  at the top. */
export const SORTS = [
  { key: 'project', label: 'project' },
  { key: 'severity', label: 'severity' },
  { key: 'recency', label: 'recency' },
] as const

export type SortKey = (typeof SORTS)[number]['key']

/** `project` moves nothing as artifacts land; the other two do. */
export const DEFAULT_SORT: SortKey = 'project'

/**
 * A ranking the levels deliberately lack — `LEVELS` is a set of treatments and
 * not a scale. It exists for ordering alone, which is why it lives here and
 * not beside them where the ingest contract could reach it.
 */
const SEVERITY: Record<Level, number> = { problem: 4, urgent: 3, soon: 2, look: 1 }

/** A lapsed flag ranks below a live one of any level rather than keeping the
 *  place its level earned. */
const severityOf = (item: WallItem, now: number): number =>
  item.attention && emphasisAt(item.attention, item.bornAt, now) > 0
    ? SEVERITY[item.attention.level]
    : 0

/** Shared so the default argument allocates nothing per call. */
const EMPTY: ReadonlySet<string> = new Set()

/** Names, not locales: the order has to be the same on every machine showing
 *  the same wall. */
const byName = (a: string, b: string): number => (a === b ? 0 : a < b ? -1 : 1)

type ZoneFacts = { zone: string; severity: number; newest: number }

function factsOf(items: readonly WallItem[], now: number): ZoneFacts[] {
  const byZone = new Map<string, ZoneFacts>()
  for (const item of items) {
    const facts = byZone.get(item.zone) ?? { zone: item.zone, severity: 0, newest: -Infinity }
    facts.severity = Math.max(facts.severity, severityOf(item, now))
    facts.newest = Math.max(facts.newest, item.bornAt)
    byZone.set(item.zone, facts)
  }
  return [...byZone.values()]
}

/**
 * The zones in the order they should be laid out, loudest or newest first.
 *
 * A pinned zone leads whatever the key says. Pinned zones among themselves fall
 * back to the key rather than to when each was pinned: the order they were
 * pinned in is nowhere on the wall, so ranking by it would move the top-left
 * cell for a reason nothing on screen explains.
 */
export function zoneOrder(
  items: readonly WallItem[],
  key: SortKey,
  now: number,
  pinned: ReadonlySet<string> = EMPTY,
): string[] {
  const facts = factsOf(items, now)
  facts.sort((a, b) => {
    const held = Number(pinned.has(b.zone)) - Number(pinned.has(a.zone))
    if (held !== 0) return held
    if (key === 'severity' && a.severity !== b.severity) return b.severity - a.severity
    if (key !== 'project' && a.newest !== b.newest) return b.newest - a.newest
    return byName(a.zone, b.zone)
  })
  return facts.map((f) => f.zone)
}

/**
 * The same order applied to whatever the layout is about to see. Zone order is
 * the insertion order of the strategy's own `byZone`, so ordering the items is
 * how a sort key reaches the wall — the strategy never learns there is one.
 */
export function inZoneOrder<T extends { zone: string }>(
  items: readonly T[],
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((zone, i) => [zone, i]))
  return [...items].sort((a, b) => (rank.get(a.zone) ?? 0) - (rank.get(b.zone) ?? 0))
}

/** The sidebar's list under the same key, pinned zones first for the same
 *  reason the wall puts them there. Ties break on arrival, newest first,
 *  because a list of flags is read from the top. */
export function sortFlags(
  items: readonly WallItem[],
  key: SortKey,
  now: number,
  pinned: ReadonlySet<string> = EMPTY,
): WallItem[] {
  return [...items].sort((a, b) => {
    const held = Number(pinned.has(b.zone)) - Number(pinned.has(a.zone))
    if (held !== 0) return held
    if (key === 'severity') {
      const rank = severityOf(b, now) - severityOf(a, now)
      if (rank !== 0) return rank
    }
    if (key === 'project' && a.zone !== b.zone) return byName(a.zone, b.zone)
    return b.bornAt - a.bornAt
  })
}
