import type { Rect } from 'windease'
import { neighborOf, type Direction } from '@/nav/neighbor.ts'

/** Each pile's cards front to back, as the renderer ranks them. */
export type Piles = ReadonlyMap<string, readonly string[]>

export type At = { zone: string; card: string }

type Opened = [zone: string, card: string]

/**
 * The zones as a person reads the wall: by row, then left to right. Rows are
 * found from the boxes rather than a grid index, so it holds under any sort.
 * Pass the front-card boxes — a pile's drawn union runs past its cell as it
 * deepens and would stagger the rows.
 */
export function readingOrder(boxes: ReadonlyMap<string, Rect>): string[] {
  const rows: [string, Rect][][] = []
  for (const entry of [...boxes].sort((a, b) => a[1].y - b[1].y)) {
    const row = rows.at(-1)
    const head = row?.[0]?.[1]
    if (row && head && entry[1].y - head.y < head.h / 2) row.push(entry)
    else rows.push([entry])
  }
  return rows.flatMap((row) => row.sort((a, b) => a[1].x - b[1].x).map(([zone]) => zone))
}

/**
 * The card ← or → opens from an open one. Left is deeper, since a pile steps
 * back to the left. With `order` — the list turned on — a pile's end carries
 * into the next pile in that order: right lands on its deepest card and left
 * on its front, so the whole wall reads as one row and every step reverses.
 * Without it a pile clamps.
 */
export function pageFrom(
  at: At,
  direction: 'left' | 'right',
  piles: Piles,
  order: readonly string[] | null,
): Opened | null {
  const pile = piles.get(at.zone) ?? []
  const from = pile.indexOf(at.card)
  if (from === -1) return null
  const within = pile[direction === 'left' ? from + 1 : from - 1]
  if (within) return [at.zone, within]

  const start = order?.indexOf(at.zone) ?? -1
  if (!order || start === -1) return null
  const step = direction === 'left' ? -1 : 1
  for (let i = start + step; i >= 0 && i < order.length; i += step) {
    const zone = order[i]!
    const next = piles.get(zone)
    if (!next || next.length === 0) continue
    return [zone, direction === 'left' ? next[0]! : next[next.length - 1]!]
  }
  return null
}

/** The front card of the neighboring pile in a direction, for shift + arrow. */
export function jumpFrom(
  zone: string,
  direction: Direction,
  boxes: ReadonlyMap<string, Rect>,
  piles: Piles,
): Opened | null {
  const next = neighborOf(boxes, zone, direction)
  const front = next === null ? undefined : piles.get(next)?.[0]
  return next !== null && front ? [next, front] : null
}

/** Where the lightbox goes when its card is deleted: what ← would open, else
 *  what → would. Deeper first, because that is the card sliding into the slot. */
export function afterDelete(at: At, piles: Piles, order: readonly string[] | null): Opened | null {
  return pageFrom(at, 'left', piles, order) ?? pageFrom(at, 'right', piles, order)
}

/**
 * The card ← or → opens on a flat wall, where there are no piles: one list,
 * newest first, laid out so that older runs right. So → is older and ← newer,
 * and the ends clamp.
 */
export function streamFrom(
  card: string,
  direction: 'left' | 'right',
  stream: readonly string[],
  zoneOf: ReadonlyMap<string, string>,
): Opened | null {
  const from = stream.indexOf(card)
  if (from === -1) return null
  const next = stream[direction === 'right' ? from + 1 : from - 1]
  const zone = next === undefined ? undefined : zoneOf.get(next)
  return next !== undefined && zone !== undefined ? [zone, next] : null
}
