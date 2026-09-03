import { describe, expect, it } from 'vitest'
import { gridStrategy } from 'windease'
import type { LayoutResult, Rect } from 'windease'

describe('the windease link', () => {
  it('resolves the source checkout, not a stale dist', () => {
    const rect: Rect = { x: 0, y: 0, z: -2, w: 1, h: 1 }
    const result: LayoutResult = {
      placements: new Map([['a', rect]]),
      affordances: [],
      channels: new Map([['a', { opacity: 1 }]]),
    }
    expect(result.channels?.get('a')?.opacity).toBe(1)
  })

  it('tiles a unit container into fractional rects', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `z${i}` }))
    const out = gridStrategy.layout({
      items,
      container: { w: 1, h: 1 },
      state: undefined,
      options: { gap: 0.02, padding: 0.02 },
    })
    expect(out.placements.size).toBe(10)
    const first = out.placements.get('z0')!
    expect(first.x).toBeCloseTo(0.02)
    expect(first.y).toBeCloseTo(0.02)
    // 4 columns at this count, so a cell is well under half the container.
    expect(first.w).toBeLessThan(0.5)
    for (const r of out.placements.values()) {
      // The one assertion a pre-z build actually fails: it emits no z at all.
      expect(r.z).toBe(0)
      expect(r.x + r.w).toBeLessThanOrEqual(1.0001)
      expect(r.y + r.h).toBeLessThanOrEqual(1.0001)
    }
  })
})
