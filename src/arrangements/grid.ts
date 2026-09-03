import type { Arrangement2D, Item, Placement, Size } from './types.ts'

const GUTTER = 0.94

/**
 * The control. Newest first in reading order, no decay signal at all — every
 * other arrangement has to justify itself against this.
 */
export const grid: Arrangement2D = {
  name: 'grid',
  dims: 2,
  arrange(items: Item[], viewport: Size): Placement[] {
    const n = items.length
    if (n === 0) return []

    const cols = Math.max(1, Math.round(Math.sqrt((n * viewport.w) / viewport.h)))
    const rows = Math.ceil(n / cols)
    const cellW = 1 / cols
    const cellH = 1 / rows
    const shortEdge = Math.min(viewport.w, viewport.h)
    const scale = (Math.min(cellW * viewport.w, cellH * viewport.h) * GUTTER) / shortEdge

    const newestFirst = [...items].sort((a, b) => a.age01 - b.age01)
    return newestFirst.map((item, i) => ({
      id: item.id,
      x: ((i % cols) + 0.5) * cellW,
      y: (Math.floor(i / cols) + 0.5) * cellH,
      scale,
      depth: 0,
      opacity: 1,
    }))
  },
}
