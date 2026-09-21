import type { WallItem } from '@shared/protocol.ts'

/** What the band filters by. `kind` is absent on the ordinary case — a
 *  picture — and an animated one is only ever told apart by its frame count,
 *  so the wall's own vocabulary is one field wider than the protocol's. */
export const KINDS = [
  { key: 'image', label: 'image' },
  { key: 'anim', label: 'anim' },
  { key: 'page', label: 'page' },
  { key: 'video', label: 'video' },
  { key: 'mesh', label: 'mesh' },
] as const

export type KindKey = (typeof KINDS)[number]['key']

export const kindOf = (item: WallItem): KindKey =>
  item.kind ?? ((item.frames ?? 1) > 1 ? 'anim' : 'image')

/** No kind picked is every kind, so the band starts unfiltered and emptying it
 *  again is how the filter is cleared. */
export const keptByKind = (item: WallItem, kinds: ReadonlySet<KindKey>): boolean =>
  kinds.size === 0 || kinds.has(kindOf(item))

/** How many of each kind the wall holds, in `KINDS` order and leaving out the
 *  kinds it holds none of: a row of buttons that filter nothing is a row that
 *  has to be read before it can be ignored. */
export function kindTally(items: readonly WallItem[]): { key: KindKey; label: string; count: number }[] {
  const counts = new Map<KindKey, number>()
  for (const item of items) {
    const key = kindOf(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return KINDS.filter((k) => counts.has(k.key)).map((k) => ({ ...k, count: counts.get(k.key) ?? 0 }))
}

/** The picked set with one kind turned on or off. A new set every time: the
 *  scene wakes on identity. */
export function toggleKind(kinds: ReadonlySet<KindKey>, key: KindKey): ReadonlySet<KindKey> {
  const next = new Set(kinds)
  if (!next.delete(key)) next.add(key)
  return next
}
