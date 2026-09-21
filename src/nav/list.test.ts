import { describe, expect, it } from 'vitest'
import type { Rect } from 'windease'
import { afterDelete, jumpFrom, pageFrom, readingOrder, streamFrom } from '@/nav/list.ts'

const box = (x: number, y: number, side = 0.2): Rect => ({ x, y, z: 0, w: side, h: side })

/** Two rows of two: a b / c d. Insertion order deliberately scrambled. */
const boxes = new Map<string, Rect>([
  ['d', box(0.5, 0.5)],
  ['a', box(0, 0)],
  ['c', box(0, 0.52)],
  ['b', box(0.5, 0.03)],
])

/** Front to back, as `cardsByZone` holds them. */
const piles = new Map<string, readonly string[]>([
  ['a', ['a1', 'a2', 'a3']],
  ['b', ['b1', 'b2']],
  ['c', ['c1']],
  ['d', ['d1', 'd2']],
])

const order = readingOrder(boxes)

describe('readingOrder', () => {
  it('reads left to right, then down a row, whatever order the map holds', () => {
    expect(order).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps a row together when its boxes sit at slightly different heights', () => {
    // b is 0.03 lower than a, well within half a box.
    expect(order.slice(0, 2)).toEqual(['a', 'b'])
  })

  it('is empty for an empty wall', () => {
    expect(readingOrder(new Map())).toEqual([])
  })
})

describe('pageFrom, unchained', () => {
  it('goes deeper on left and forward on right', () => {
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'left', piles, null)).toEqual(['a', 'a2'])
    expect(pageFrom({ zone: 'a', card: 'a2' }, 'right', piles, null)).toEqual(['a', 'a1'])
  })

  it('clamps at both ends of a pile', () => {
    expect(pageFrom({ zone: 'a', card: 'a3' }, 'left', piles, null)).toBeNull()
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'right', piles, null)).toBeNull()
  })

  it('is null for a card the pile does not hold', () => {
    expect(pageFrom({ zone: 'a', card: 'zz' }, 'left', piles, null)).toBeNull()
  })
})

describe('pageFrom, as one list', () => {
  it('carries right past a front card into the next pile at its deepest', () => {
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'right', piles, order)).toEqual(['b', 'b2'])
  })

  it('carries left past a deepest card into the previous pile at its front', () => {
    expect(pageFrom({ zone: 'b', card: 'b2' }, 'left', piles, order)).toEqual(['a', 'a1'])
  })

  it('reverses every step exactly', () => {
    const there = pageFrom({ zone: 'a', card: 'a1' }, 'right', piles, order)!
    expect(pageFrom({ zone: there[0], card: there[1] }, 'left', piles, order)).toEqual(['a', 'a1'])
  })

  it('wraps onto the next row', () => {
    expect(pageFrom({ zone: 'b', card: 'b1' }, 'right', piles, order)).toEqual(['c', 'c1'])
  })

  it('still pages within a pile the way it always has', () => {
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'left', piles, order)).toEqual(['a', 'a2'])
  })

  it('ends at the first and last card on the wall', () => {
    expect(pageFrom({ zone: 'a', card: 'a3' }, 'left', piles, order)).toBeNull()
    expect(pageFrom({ zone: 'd', card: 'd1' }, 'right', piles, order)).toBeNull()
  })

  it('skips a zone with no cards', () => {
    const holey = new Map(piles).set('b', [])
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'right', holey, order)).toEqual(['c', 'c1'])
  })
})

describe('jumpFrom', () => {
  it('opens the front card of the neighboring pile in any direction', () => {
    expect(jumpFrom('a', 'right', boxes, piles)).toEqual(['b', 'b1'])
    expect(jumpFrom('a', 'down', boxes, piles)).toEqual(['c', 'c1'])
    expect(jumpFrom('d', 'up', boxes, piles)).toEqual(['b', 'b1'])
  })

  it('is null at the edge of the wall', () => {
    expect(jumpFrom('a', 'left', boxes, piles)).toBeNull()
  })
})

describe('afterDelete', () => {
  it('prefers the deeper card, which is the one that slides into the slot', () => {
    expect(afterDelete({ zone: 'a', card: 'a2' }, piles, null)).toEqual(['a', 'a3'])
  })

  it('falls back to the nearer card at the back of a pile', () => {
    expect(afterDelete({ zone: 'a', card: 'a3' }, piles, null)).toEqual(['a', 'a2'])
  })

  it('leaves nowhere to go when the pile held only that card and the list is off', () => {
    expect(afterDelete({ zone: 'c', card: 'c1' }, piles, null)).toBeNull()
  })

  it('crosses into a neighboring pile when the list is on', () => {
    expect(afterDelete({ zone: 'c', card: 'c1' }, piles, order)).toEqual(['b', 'b1'])
  })
})

describe('streamFrom', () => {
  const zones = new Map([
    ['n', 'a'],
    ['m', 'b'],
    ['o', 'a'],
  ])
  const stream = ['n', 'm', 'o']

  it('goes older to the right and newer to the left, with each card in its own zone', () => {
    expect(streamFrom('n', 'right', stream, zones)).toEqual(['b', 'm'])
    expect(streamFrom('m', 'left', stream, zones)).toEqual(['a', 'n'])
  })

  it('clamps at both ends', () => {
    expect(streamFrom('n', 'left', stream, zones)).toBeNull()
    expect(streamFrom('o', 'right', stream, zones)).toBeNull()
  })
})

describe('skipping what the band filtered out', () => {
  const skip = (...out: string[]) => {
    const set = new Set(out)
    return (card: string) => set.has(card)
  }

  it('pages past an excluded card to the next one in the pile', () => {
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'left', piles, null, skip('a2'))).toEqual(['a', 'a3'])
  })

  it('clamps when every card deeper in the pile is excluded and the list is off', () => {
    expect(pageFrom({ zone: 'a', card: 'a1' }, 'left', piles, null, skip('a2', 'a3'))).toBeNull()
  })

  it('passes over a pile of nothing but excluded cards when the list is on', () => {
    expect(pageFrom({ zone: 'a', card: 'a3' }, 'right', piles, order, skip('a2', 'a1'))).toEqual([
      'b',
      'b2',
    ])
  })

  it('enters the next pile at the end the direction reverses onto, then walks inward', () => {
    expect(pageFrom({ zone: 'b', card: 'b2' }, 'left', piles, order, skip('a1'))).toEqual(['a', 'a2'])
  })

  it('carries a delete past an excluded card', () => {
    expect(afterDelete({ zone: 'a', card: 'a1' }, piles, null, skip('a2'))).toEqual(['a', 'a3'])
  })

  it('steps the flat wall past an excluded card', () => {
    const zones = new Map([
      ['n', 'a'],
      ['m', 'b'],
      ['o', 'a'],
    ])
    expect(streamFrom('n', 'right', ['n', 'm', 'o'], zones, skip('m'))).toEqual(['a', 'o'])
    expect(streamFrom('n', 'right', ['n', 'm', 'o'], zones, skip('m', 'o'))).toBeNull()
  })
})
