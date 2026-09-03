import { describe, expect, it } from 'vitest'
import { reduceView, type ViewState, WALL } from '@/view-state.ts'

describe('reduceView', () => {
  it('starts at the wall', () => {
    expect(WALL).toEqual({ kind: 'wall' })
  })

  it('zooms from the wall to a pile', () => {
    expect(reduceView(WALL, { type: 'zoom', zone: 'windease' })).toEqual({
      kind: 'stack',
      zone: 'windease',
    })
  })

  it('walks between piles without going back to the wall', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'zoom', zone: 'slopboard' })).toEqual({
      kind: 'stack',
      zone: 'slopboard',
    })
  })

  it('opens the lightbox from a pile, remembering which pile', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'open', id: 'img-1' })).toEqual({
      kind: 'lightbox',
      zone: 'windease',
      id: 'img-1',
    })
  })

  it('escapes the lightbox back to its pile, not to the wall', () => {
    const at: ViewState = { kind: 'lightbox', zone: 'windease', id: 'img-1' }
    expect(reduceView(at, { type: 'escape' })).toEqual({ kind: 'stack', zone: 'windease' })
  })

  it('escapes a pile back to the wall', () => {
    expect(reduceView({ kind: 'stack', zone: 'windease' }, { type: 'escape' })).toEqual(WALL)
  })

  it('escapes the wall to nothing — there is nowhere further out', () => {
    expect(reduceView(WALL, { type: 'escape' })).toEqual(WALL)
  })

  it('refuses to open the lightbox from the wall, where no image is addressed', () => {
    expect(reduceView(WALL, { type: 'open', id: 'img-1' })).toEqual(WALL)
  })

  it('drops back to the wall when the zone it is showing leaves', () => {
    expect(reduceView({ kind: 'stack', zone: 'gone' }, { type: 'zones', live: ['windease'] })).toEqual(WALL)
  })

  it('keeps its place when the zone it is showing is still live', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'zones', live: ['windease', 'slopboard'] })).toEqual(at)
  })
})
