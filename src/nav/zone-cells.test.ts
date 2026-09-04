import { describe, expect, it } from 'vitest'
import type { Rect } from 'windease'
import { baseCellsOf, unionOf, zoneCellsOf, withHeadroom } from '@/nav/zone-cells.ts'

const at = (x: number, y: number, side = 1): Rect => ({ x, y, z: 0, w: side, h: side })

describe('zoneCellsOf', () => {
  it('treats a placement as top-left anchored, because that is how the mesh is hung', () => {
    const cells = zoneCellsOf(new Map([['a', at(0, 0, 2)]]), new Map([['a', 'z']]))
    // A 2-wide card hung at the origin spans 0..2, so the box starts there.
    expect(cells.get('z')).toEqual({ x: 0, y: 0, z: 0, w: 2, h: 2 })
  })

  it('grows to cover every item in the zone', () => {
    const cells = zoneCellsOf(
      new Map([
        ['a', at(0, 0)],
        ['b', at(4, 2)],
      ]),
      new Map([
        ['a', 'z'],
        ['b', 'z'],
      ]),
    )
    expect(cells.get('z')).toEqual({ x: 0, y: 0, z: 0, w: 5, h: 3 })
  })

  it('keeps zones apart', () => {
    const cells = zoneCellsOf(
      new Map([
        ['a', at(0, 0)],
        ['b', at(9, 0)],
      ]),
      new Map([
        ['a', 'one'],
        ['b', 'two'],
      ]),
    )
    expect(cells.size).toBe(2)
    expect(cells.get('one')!.x).toBe(0)
    expect(cells.get('two')!.x).toBe(9)
  })

  it('skips a placement whose zone it does not know', () => {
    expect(zoneCellsOf(new Map([['a', at(0, 0)]]), new Map()).size).toBe(0)
  })
})

describe('unionOf', () => {
  it('covers every box', () => {
    expect(unionOf([at(0, 0), at(4, 2)])).toEqual({ x: 0, y: 0, z: 0, w: 5, h: 3 })
  })

  it('is null for nothing, so a caller falls back rather than framing a point', () => {
    expect(unionOf([])).toBeNull()
  })
})

describe('withHeadroom', () => {
  it('grows the box upward, because a label hangs above its cell', () => {
    const out = withHeadroom({ x: 1, y: 2, z: 0, w: 4, h: 6 }, 0.5)
    expect(out).toEqual({ x: 1, y: 1.5, z: 0, w: 4, h: 6.5 })
  })

  it('is the box itself when there is no headroom to add', () => {
    const box = { x: 1, y: 2, z: 0, w: 4, h: 6 }
    expect(withHeadroom(box, 0)).toEqual(box)
  })
})

describe('baseCellsOf', () => {
  const zoneOf = new Map([
    ['a0', 'alpha'],
    ['a1', 'alpha'],
    ['a2', 'alpha'],
    ['b0', 'beta'],
  ])

  it('takes the front card of each pile, not the sprawl behind it', () => {
    const placements = new Map([
      ['a1', { x: 0.1, y: 0.1, z: -0.035, w: 0.22, h: 0.22 }],
      ['a0', { x: 0, y: 0, z: 0, w: 0.22, h: 0.22 }],
      ['a2', { x: 0.2, y: 0.2, z: -0.07, w: 0.22, h: 0.22 }],
      ['b0', { x: 1, y: 0, z: 0, w: 0.22, h: 0.22 }],
    ])
    const base = baseCellsOf(placements, zoneOf)
    expect(base.get('alpha')).toEqual({ x: 0, y: 0, z: 0, w: 0.22, h: 0.22 })
    expect(base.get('beta')).toEqual({ x: 1, y: 0, z: 0, w: 0.22, h: 0.22 })
  })

  it('gives every pile the same size, however deep it has grown', () => {
    const placements = new Map([
      ['a0', { x: 0, y: 0, z: 0, w: 0.22, h: 0.22 }],
      ['a1', { x: 0.1, y: 0.1, z: -0.035, w: 0.22, h: 0.22 }],
      ['b0', { x: 1, y: 0, z: 0, w: 0.22, h: 0.22 }],
    ])
    const base = baseCellsOf(placements, zoneOf)
    expect(base.get('alpha')!.w).toBe(base.get('beta')!.w)
    // The union would not have: alpha's second rank steps past its own card.
    const drawn = zoneCellsOf(placements, zoneOf)
    expect(drawn.get('alpha')!.w).toBeGreaterThan(drawn.get('beta')!.w)
  })

  it('ignores a placement whose zone it does not know', () => {
    const placements = new Map([['orphan', { x: 0, y: 0, z: 0, w: 1, h: 1 }]])
    expect(baseCellsOf(placements, zoneOf).size).toBe(0)
  })

  it('is empty for an empty wall', () => {
    expect(baseCellsOf(new Map(), zoneOf).size).toBe(0)
  })
})
