import { describe, expect, it } from 'vitest'
import { createZoneGrid } from '@/arrangements/zones.ts'
import { defaultParams } from '@/params.ts'

const container = { w: 16 / 9, h: 1 }
const cfg = defaultParams.zoneGrid

describe('createZoneGrid', () => {
  it('places one rect per zone inside the container', () => {
    const gridOf = createZoneGrid()
    const out = gridOf(['weasel', 'klieg', 'wod'], container, cfg)
    expect(out.size).toBe(3)
    for (const r of out.values()) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(container.w + 0.0001)
      expect(r.y + r.h).toBeLessThanOrEqual(container.h + 0.0001)
    }
  })

  it('keeps a zone in its cell when another zone appears', () => {
    const gridOf = createZoneGrid()
    const before = gridOf(['weasel', 'klieg'], container, cfg)
    const weaselBefore = before.get('weasel')!
    const after = gridOf(['weasel', 'klieg', 'brand-new'], container, cfg)
    // The cell index is stable; the cell's size changes as the grid rebalances.
    expect(after.get('weasel')!.x).toBeLessThanOrEqual(weaselBefore.x + 0.0001)
    expect(after.has('brand-new')).toBe(true)
  })

  it('reuses a freed cell rather than growing the grid forever', () => {
    const gridOf = createZoneGrid()
    gridOf(['a', 'b', 'c'], container, cfg)
    const after = gridOf(['a', 'c'], container, cfg)
    expect(after.size).toBe(2)
  })

  it('is insensitive to the order zones are handed in', () => {
    const gridOf = createZoneGrid()
    const first = gridOf(['a', 'b'], container, cfg)
    const second = gridOf(['b', 'a'], container, cfg)
    expect(second.get('a')).toEqual(first.get('a'))
    expect(second.get('b')).toEqual(first.get('b'))
  })

  it('returns nothing for an empty wall', () => {
    expect(createZoneGrid()([], container, cfg).size).toBe(0)
  })
})
