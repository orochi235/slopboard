import type { Arrangement, Item, Placement, Size } from './types.ts'
import { createSlots, ramp } from './slots.ts'

const CELLS = 48
const GUTTER = 0.9

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/**
 * Sequential slots must land in scattered cells. Filling in raster order packs
 * the top rows newest-last, which makes position encode age — the one thing
 * this arrangement exists to hold constant.
 */
function scatter(slot: number, total: number) {
  let stride = Math.max(1, Math.round(total / 1.618))
  while (gcd(stride, total) !== 1) stride++
  return (slot * stride) % total
}

/**
 * Zero motion. An item takes a cell at arrival and never moves; decay is
 * desaturation, then blur, then dissolve. The grid is sized to a fixed cell
 * count rather than to the live item count, because resizing it would move
 * everything and cost the arrangement its entire premise — so a quiet wall
 * is a sparse one. Tests whether motion is needed at all.
 */
export function createErode(): Arrangement {
  const slots = createSlots()

  return {
    name: 'erode',
    needs3d: false,
    arrange(items: Item[], viewport: Size): Placement[] {
      const oldestFirst = [...items].sort((a, b) => b.age01 - a.age01)
      const held = slots(oldestFirst.map((i) => i.id))

      const cols = Math.max(1, Math.round(Math.sqrt((CELLS * viewport.w) / viewport.h)))
      const rows = Math.ceil(CELLS / cols)
      const scale =
        (Math.min(viewport.w / cols, viewport.h / rows) * GUTTER) /
        Math.min(viewport.w, viewport.h)

      return oldestFirst.map((item) => {
        const total = cols * rows
        const cell = scatter((held.get(item.id) ?? 0) % total, total)
        return {
          id: item.id,
          x: ((cell % cols) + 0.5) / cols,
          y: (Math.floor(cell / cols) + 0.5) / rows,
          scale,
          depth: 0,
          opacity: 1 - ramp(item.age01, 0.82, 1),
          blur: 7 * ramp(item.age01, 0.55, 1),
          saturation: 1 - 0.95 * ramp(item.age01, 0.12, 0.7),
        }
      })
    },
  }
}
