import type { Rect } from 'windease'

export type Direction = 'left' | 'right' | 'up' | 'down'

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** Drift off the axis costs more than distance along it, so a cell straight
 *  ahead beats a nearer one to the side. */
const CROSS_PENALTY = 3

/**
 * Resolved against the cells themselves rather than a remembered row/column, so
 * a zone arriving and re-tiling the wall cannot desync the cursor.
 *
 * Rect space grows downward, so `down` is increasing y. The renderer flips y
 * once when it converts a rect to a world position; navigation never sees it.
 */
export function neighbourOf(
  cells: ReadonlyMap<string, Rect>,
  from: string,
  direction: Direction,
): string | null {
  const source = cells.get(from)
  if (!source) return null
  const origin = centre(source)

  let best: { id: string; score: number } | null = null
  for (const [id, rect] of cells) {
    if (id === from) continue
    const c = centre(rect)
    const dx = c.x - origin.x
    const dy = c.y - origin.y

    let along: number
    let across: number
    if (direction === 'left') {
      if (dx >= 0) continue
      along = -dx
      across = Math.abs(dy)
    } else if (direction === 'right') {
      if (dx <= 0) continue
      along = dx
      across = Math.abs(dy)
    } else if (direction === 'up') {
      if (dy >= 0) continue
      along = -dy
      across = Math.abs(dx)
    } else {
      if (dy <= 0) continue
      along = dy
      across = Math.abs(dx)
    }

    const score = along + CROSS_PENALTY * across
    if (!best || score < best.score) best = { id, score }
  }
  return best ? best.id : null
}
