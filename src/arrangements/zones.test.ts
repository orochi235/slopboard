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

  it('fills cells in the order handed in when the sort asks for it', () => {
    const gridOf = createZoneGrid()
    const held = gridOf(['a', 'b'], container, cfg)
    const given = gridOf(['b', 'a'], container, cfg, 'given')
    expect(given.get('b')).toEqual(held.get('a'))
    expect(given.get('a')).toEqual(held.get('b'))
  })

  it('does not let a given order disturb the cells it holds', () => {
    const gridOf = createZoneGrid()
    const before = gridOf(['a', 'b'], container, cfg)
    gridOf(['b', 'a'], container, cfg, 'given')
    expect(gridOf(['a', 'b'], container, cfg)).toEqual(before)
  })

  it('returns nothing for an empty wall', () => {
    expect(createZoneGrid()([], container, cfg).size).toBe(0)
  })
})

describe('reversing an axis', () => {
  const container = { w: 2, h: 1 }
  const cfg = { gap: 0, orientation: 'wide' as const, reverseX: false, reverseY: false }
  const place = (over: Partial<typeof cfg>) =>
    createZoneGrid()(['a', 'b'], container, { ...cfg, ...over })

  it('mirrors x without renumbering, so a zone keeps its pile', () => {
    const plain = place({})
    const flipped = place({ reverseX: true })
    const a = plain.get('a')!
    expect(flipped.get('a')!.x).toBeCloseTo(container.w - (a.x + a.w))
    expect(flipped.get('a')!.w).toBeCloseTo(a.w)
  })

  it('mirrors y the same way', () => {
    const a = place({}).get('a')!
    expect(place({ reverseY: true }).get('a')!.y).toBeCloseTo(container.h - (a.y + a.h))
  })

  it('leaves the placements untouched when neither axis is reversed', () => {
    expect(place({})).toEqual(place({}))
  })
})
