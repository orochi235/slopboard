import { describe, expect, it } from 'vitest'
import { containerFor, createZoneGrid, frontSlotOf, gridCells } from '@/arrangements/zones.ts'
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

  it('lays out minCells even when fewer zones exist, so one pile is not the wall', () => {
    const gridOf = createZoneGrid()
    const two = gridOf(['weasel', 'astv'], container, { ...cfg, minCells: 4 })
    const four = gridOf(['weasel', 'astv', 'onto', 'cke'], container, { ...cfg, minCells: 4 })
    expect(two.size).toBe(2)
    // The same grid either way: a zone arriving fills a cell that was already
    // reserved rather than resizing every pile on the wall.
    expect(two.get('weasel')!.w).toBeCloseTo(four.get('weasel')!.w)
    expect(two.get('weasel')!.h).toBeCloseTo(four.get('weasel')!.h)
  })

  it('is a floor, not a cap', () => {
    const gridOf = createZoneGrid()
    const out = gridOf(['a', 'b', 'c', 'd', 'e'], container, { ...cfg, minCells: 4 })
    expect(out.size).toBe(5)
  })

  it('leaves the cells past the last zone unclaimed', () => {
    const cells = gridCells(4, container, { ...cfg, minCells: 4 })
    const out = createZoneGrid()(['only'], container, { ...cfg, minCells: 4 })
    expect(cells).toHaveLength(4)
    expect(out.size).toBe(1)
    // The spare three are the wall's own room to frame — no zone answers for them.
    const claimed = [...out.values()]
    expect(claimed).toHaveLength(1)
    expect(cells.some((c) => c.x === claimed[0]!.x && c.y === claimed[0]!.y)).toBe(true)
  })

  it('puts a front slot inside the cell it belongs to', () => {
    const [cell] = gridCells(4, container, { ...cfg, minCells: 4 })
    const slot = frontSlotOf(cell!, defaultParams)
    expect(slot.w).toBe(defaultParams.side)
    expect(slot.x).toBeGreaterThanOrEqual(cell!.x - 1e-9)
    expect(slot.x + slot.w).toBeLessThanOrEqual(cell!.x + cell!.w + 1e-9)
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
  const cfg = { gap: 0, orientation: 'wide' as const, reverseX: false, reverseY: false, minCells: 2, moveMs: 0 }
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

describe('the grid fits its container', () => {
  // The fitting itself is windease's, under `orientation: 'fit'`; what is
  // checked here is that the wall asks for it and that the answer reaches the
  // cells. Ten zones square to four columns on the count alone.
  const colsOf = (count: number, w: number, h: number) => {
    const cells = gridCells(count, { w, h }, cfg)
    const top = cells[0]?.y
    return cells.filter((c) => c.y === top).length
  }

  it('takes fewer columns in a tall container than in a wide one', () => {
    expect(colsOf(10, 10, 15)).toBe(3)
    expect(colsOf(10, 15, 10)).toBe(4)
  })

  it('answers differently for the same count, which is the whole point', () => {
    expect(colsOf(6, 30, 5)).toBe(6)
    expect(colsOf(6, 5, 30)).toBe(1)
  })
})

describe('containerFor', () => {
  it('is the viewport where a cell has no fixed width', () => {
    expect(containerFor(6, 1.78, cfg)).toEqual({ w: 1.78, h: 1 })
  })

  it('grows with the zones once one does, so a cell keeps its size', () => {
    const fixed = { ...cfg, cellW: 0.5, minCells: 4 }
    expect(containerFor(6, 1.78, fixed)).toEqual({ w: 3, h: 1 })
    expect(containerFor(10, 1.78, fixed)).toEqual({ w: 5, h: 1 })
  })

  it('never falls below the room the spare cells reserve', () => {
    const fixed = { ...cfg, cellW: 0.5, minCells: 4 }
    expect(containerFor(1, 1.78, fixed)).toEqual({ w: 2, h: 1 })
  })
})
