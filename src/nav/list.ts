import type { Rect } from 'windease'
import { neighborOf, type Direction } from '@/nav/neighbor.ts'

/** Each pile's cards front to back, as the renderer ranks them. */
export type Piles = ReadonlyMap<string, readonly string[]>

export type At = { zone: string; card: string }

/** Cards paging runs past — what the band has filtered out. */
export type Skip = (card: string) => boolean

const never: Skip = () => false

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
 *
 * `skip` is the band's filters: a card the band excludes is still on the wall,
 * dimmed, but paging runs past it rather than stopping on what was just
 * filtered out.
 */
export function pageFrom(
  at: At,
  direction: 'left' | 'right',
  piles: Piles,
  order: readonly string[] | null,
  skip: Skip = never,
): Opened | null {
  const pile = piles.get(at.zone) ?? []
  const from = pile.indexOf(at.card)
  if (from === -1) return null
  const step = direction === 'left' ? 1 : -1
  for (let i = from + step; i >= 0 && i < pile.length; i += step) {
    const card = pile[i]!
    if (!skip(card)) return [at.zone, card]
  }

  const start = order?.indexOf(at.zone) ?? -1
  if (!order || start === -1) return null
  const zoneStep = direction === 'left' ? -1 : 1
  for (let i = start + zoneStep; i >= 0 && i < order.length; i += zoneStep) {
    const next = piles.get(order[i]!)
    if (!next || next.length === 0) continue
    // Entered from the end the direction reverses onto, and walked inward from
    // there, so a pile of nothing but excluded cards is passed over whole.
    const inward = direction === 'left' ? 1 : -1
    for (let j = direction === 'left' ? 0 : next.length - 1; j >= 0 && j < next.length; j += inward) {
      const card = next[j]!
      if (!skip(card)) return [order[i]!, card]
    }
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
export function afterDelete(
  at: At,
  piles: Piles,
  order: readonly string[] | null,
  skip: Skip = never,
): Opened | null {
  return pageFrom(at, 'left', piles, order, skip) ?? pageFrom(at, 'right', piles, order, skip)
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
  skip: Skip = never,
): Opened | null {
  const from = stream.indexOf(card)
  if (from === -1) return null
  const step = direction === 'right' ? 1 : -1
  for (let i = from + step; i >= 0 && i < stream.length; i += step) {
    const next = stream[i]!
    if (skip(next)) continue
    const zone = zoneOf.get(next)
    if (zone !== undefined) return [zone, next]
  }
  return null
}
