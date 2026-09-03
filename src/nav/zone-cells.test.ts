import { describe, expect, it } from 'vitest'
import type { Rect } from 'windease'
import { unionOf, zoneCellsOf } from '@/nav/zone-cells.ts'

const at = (x: number, y: number, side = 1): Rect => ({ x, y, z: 0, w: side, h: side })

describe('zoneCellsOf', () => {
  it('treats a placement as centred, because that is how the mesh is anchored', () => {
    const cells = zoneCellsOf(new Map([['a', at(0, 0, 2)]]), new Map([['a', 'z']]))
    // A 2-wide card centred on the origin spans -1..1, so the box starts at -1.
    expect(cells.get('z')).toEqual({ x: -1, y: -1, z: 0, w: 2, h: 2 })
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
    expect(cells.get('z')).toEqual({ x: -0.5, y: -0.5, z: 0, w: 5, h: 3 })
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
    expect(cells.get('one')!.x).toBe(-0.5)
    expect(cells.get('two')!.x).toBe(8.5)
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
