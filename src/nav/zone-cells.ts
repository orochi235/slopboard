import type { Rect } from 'windease'

/**
 * One bounding box per zone. A placement's x/y is its **top-left**, the
 * convention windease's own strategies place on, so a box is the union of
 * `x..x+w` rather than a half-extent either side of a centre.
 *
 * The strategy does not publish its cells and re-deriving them here is cheaper
 * than widening its return type. It also covers what is actually drawn, which
 * the nominal grid cell does not: a pile's deep cards step past their cell.
 */
export function zoneCellsOf(
  placements: ReadonlyMap<string, Rect>,
  zoneOf: ReadonlyMap<string, string>,
): Map<string, Rect> {
  const bounds = new Map<string, { x0: number; y0: number; x1: number; y1: number }>()
  for (const [id, r] of placements) {
    const zone = zoneOf.get(id)
    if (zone === undefined) continue
    const seen = bounds.get(zone)
    if (!seen) bounds.set(zone, { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h })
    else {
      seen.x0 = Math.min(seen.x0, r.x)
      seen.y0 = Math.min(seen.y0, r.y)
      seen.x1 = Math.max(seen.x1, r.x + r.w)
      seen.y1 = Math.max(seen.y1, r.y + r.h)
    }
  }

  const out = new Map<string, Rect>()
  for (const [zone, b] of bounds) {
    out.set(zone, { x: b.x0, y: b.y0, z: 0, w: b.x1 - b.x0, h: b.y1 - b.y0 })
  }
  return out
}

/** The box covering every box given, or null for none — a caller frames its
 *  container instead rather than framing a point. */
export function unionOf(boxes: readonly Rect[]): Rect | null {
  if (boxes.length === 0) return null
  let x0 = Number.POSITIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (const b of boxes) {
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  return { x: x0, y: y0, z: 0, w: x1 - x0, h: y1 - y0 }
}

/** A box grown upward, so something drawn above it — a zone's label — is inside
 *  what the camera frames. windease's y grows downward, so "up" is less y. */
export function withHeadroom(box: Rect, headroom: number): Rect {
  return headroom === 0 ? box : { ...box, y: box.y - headroom, h: box.h + headroom }
}

/**
 * The front card of each pile — the base the stack rises from, before its deep
 * ranks step past it. The plan view draws these rather than the drawn union, so
 * a pile that has grown reads as an icon in its place rather than as a zone
 * that has swallowed more of the wall than its neighbour.
 *
 * Rank 0 sits at z 0 and deeper ranks step away, so the front card is the
 * greatest z.
 */
export function baseCellsOf(
  placements: ReadonlyMap<string, Rect>,
  zoneOf: ReadonlyMap<string, string>,
): Map<string, Rect> {
  const out = new Map<string, Rect>()
  for (const [id, r] of placements) {
    const zone = zoneOf.get(id)
    if (zone === undefined) continue
    const held = out.get(zone)
    if (!held || r.z > held.z) out.set(zone, r)
  }
  return out
}
