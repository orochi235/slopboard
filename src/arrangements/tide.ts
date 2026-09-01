import type { Arrangement, Item, Placement, Size } from './types.ts'
import { createSequencer, ramp } from './slots.ts'

const LANES = 6
const OVERSHOOT = 0.14 // enter and leave fully off-wall
const FADE = 0.06

/**
 * Constant-velocity drift across the wall; position *is* age, and size never
 * changes. Tests whether one coherent motion field reads better in peripheral
 * vision than N independent fades — periphery detects coherent motion well and
 * sub-threshold luminance change barely at all.
 */
export function createTide(): Arrangement {
  const sequence = createSequencer()

  return {
    name: 'tide',
    needs3d: false,
    arrange(items: Item[], viewport: Size): Placement[] {
      const oldestFirst = [...items].sort((a, b) => b.age01 - a.age01)
      const lanes = sequence(oldestFirst.map((i) => i.id))
      const laneH = viewport.h / LANES
      const scale = (laneH * 0.82) / Math.min(viewport.w, viewport.h)

      return oldestFirst.map((item) => {
        const lane = (lanes.get(item.id) ?? 0) % LANES
        // Opacity softens the wall's edges only; age is carried by x alone.
        const edge = Math.min(ramp(item.age01, 0, FADE), 1 - ramp(item.age01, 1 - FADE, 1))
        return {
          id: item.id,
          x: -OVERSHOOT + item.age01 * (1 + 2 * OVERSHOOT),
          y: (lane + 0.5) / LANES,
          scale,
          depth: item.age01,
          opacity: edge,
        }
      })
    },
  }
}
