import { describe, expect, it } from 'vitest'
import { cardOf, depthOf, descend, hashOfView, viewFromHash, reduceView, type ViewState, WALL, zoneOf } from '@/view-state.ts'

const at = (...path: string[]): ViewState => ({ path })

describe('reduceView', () => {
  it('starts at the wall, which is the empty path', () => {
    expect(WALL).toEqual({ path: [] })
  })

  it('climbs back one rung at a time', () => {
    expect(reduceView(at('weasel', 'img-1'), { type: 'out' })).toEqual(at('weasel'))
    expect(reduceView(at('weasel'), { type: 'out' })).toEqual(WALL)
  })

  it('stays at the wall, where there is nowhere further out', () => {
    expect(reduceView(WALL, { type: 'out' })).toEqual(WALL)
  })

  it('knows nothing about what a rung is, so a deeper hierarchy needs no new case', () => {
    // The reducer is the half of the navigation that generalizes for free. What
    // a rung means — a box to frame, an overlay to raise — is the renderer's.
    const deep = reduceView(at('a', 'b'), { type: 'to', path: ['a', 'b', 'c', 'd'] })
    expect(deep).toEqual(at('a', 'b', 'c', 'd'))
    expect(reduceView(deep, { type: 'out' })).toEqual(at('a', 'b', 'c'))
  })

  it('descends by landing on a longer path, which is how a step arrives', () => {
    expect(reduceView(WALL, { type: 'to', path: ['weasel'] })).toEqual(at('weasel'))
  })

  it('jumps to a path outright, which is how the minimap and a sideways step arrive', () => {
    expect(reduceView(at('alpha', 'img-1'), { type: 'to', path: ['beta'] })).toEqual(at('beta'))
  })

  it('holds the same object when a jump lands where it already is', () => {
    const held = at('beta')
    expect(reduceView(held, { type: 'to', path: ['beta'] })).toBe(held)
  })

  it('falls back to the wall when the zone it is showing leaves', () => {
    expect(reduceView(at('gone', 'img-1'), { type: 'prune', live: ['weasel'] })).toEqual(WALL)
  })

  it('keeps its place when the zone it is showing is still live', () => {
    const held = at('weasel', 'img-1')
    expect(reduceView(held, { type: 'prune', live: ['weasel', 'slopboard'] })).toBe(held)
  })

  it('leaves the wall alone when zones come and go', () => {
    expect(reduceView(WALL, { type: 'prune', live: [] })).toBe(WALL)
  })
})

describe('accessors', () => {
  it('name the rungs today’s wall has, in the one file that knows them', () => {
    expect(depthOf(WALL)).toBe(0)
    expect(zoneOf(WALL)).toBeNull()
    expect(cardOf(at('weasel'))).toBeNull()
    expect(zoneOf(at('weasel', 'img-1'))).toBe('weasel')
    expect(cardOf(at('weasel', 'img-1'))).toBe('img-1')
  })
})

describe('descend', () => {
  const fronts: Record<string, string> = { weasel: 'img-1' }
  const frontOf = (zone: string) => fronts[zone]

  it('takes the wall to the pile the cursor is on, not past it', () => {
    expect(descend([], 'weasel', frontOf)).toEqual(['weasel'])
  })

  it('does nothing at the wall without a cursor', () => {
    expect(descend([], null, frontOf)).toBeNull()
  })

  it('takes a pile to its front card', () => {
    expect(descend(['weasel'], null, frontOf)).toEqual(['weasel', 'img-1'])
  })

  it('stops at an empty pile and at a card', () => {
    expect(descend(['empty'], null, frontOf)).toBeNull()
    expect(descend(['weasel', 'img-1'], null, frontOf)).toBeNull()
  })
})

describe('the view in the URL', () => {
  it('round-trips a zone and a card, including names a URL has to escape', () => {
    for (const path of [['weasel'], ['weasel', 'img-1'], ['a b#c', 'x/y%z']]) {
      expect(viewFromHash(hashOfView({ path }))).toEqual({ path })
    }
  })

  it('writes the wall as no fragment at all', () => {
    expect(hashOfView(WALL)).toBe('')
    expect(viewFromHash('')).toEqual(WALL)
    expect(viewFromHash('#')).toEqual(WALL)
    expect(viewFromHash('#/')).toEqual(WALL)
  })

  it('reads a fragment it cannot decode, or one too deep, as far as it can', () => {
    expect(viewFromHash('#/%E0%A4%A')).toEqual(WALL)
    expect(viewFromHash('#/weasel/img-1/extra')).toEqual({ path: ['weasel', 'img-1'] })
  })
})

describe('pruning a card', () => {
  it('drops a card that is gone back to its zone, and keeps a live one', () => {
    const open: ViewState = { path: ['weasel', 'img-1'] }
    expect(reduceView(open, { type: 'prune', live: ['weasel'], cards: ['img-2'] })).toEqual({
      path: ['weasel'],
    })
    expect(reduceView(open, { type: 'prune', live: ['weasel'], cards: ['img-1'] })).toBe(open)
  })
})
