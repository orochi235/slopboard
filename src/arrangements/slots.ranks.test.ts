import { describe, expect, it } from 'vitest'
import { createRanks } from '@/arrangements/slots.ts'

describe('createRanks', () => {
  it('ranks by position in the given order, newest first', () => {
    const ranks = createRanks()
    const held = ranks(['a', 'b', 'c'], 1000)
    expect(held.get('a')?.rank).toBe(0)
    expect(held.get('c')?.rank).toBe(2)
  })

  it('starts an item settled, so a dropped cache snaps instead of animating', () => {
    const ranks = createRanks()
    const held = ranks(['a'], 1000)
    expect(held.get('a')).toEqual({ rank: 0, prevRank: 0, changedAt: 1000 })
  })

  it('records the previous rank and the moment it changed on an arrival', () => {
    const ranks = createRanks()
    ranks(['a'], 1000)
    const held = ranks(['new', 'a'], 1500)
    expect(held.get('a')).toEqual({ rank: 1, prevRank: 0, changedAt: 1500 })
    expect(held.get('new')).toEqual({ rank: 0, prevRank: 0, changedAt: 1500 })
  })

  it('moves items forward when one expires out of the middle', () => {
    const ranks = createRanks()
    ranks(['a', 'b', 'c'], 1000)
    const held = ranks(['a', 'c'], 2000)
    expect(held.get('c')).toEqual({ rank: 1, prevRank: 2, changedAt: 2000 })
    // 'a' never moved, so its transition is untouched and already complete.
    expect(held.get('a')).toEqual({ rank: 0, prevRank: 0, changedAt: 1000 })
  })

  it('does not restart a transition while the rank holds steady', () => {
    const ranks = createRanks()
    ranks(['a'], 1000)
    ranks(['new', 'a'], 1500)
    const held = ranks(['new', 'a'], 1900)
    expect(held.get('a')?.changedAt).toBe(1500)
  })

  it('forgets items that are gone', () => {
    const ranks = createRanks()
    ranks(['a', 'b'], 1000)
    const held = ranks(['a'], 2000)
    expect(held.has('b')).toBe(false)
  })
})
