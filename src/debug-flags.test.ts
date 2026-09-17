import { describe, expect, it } from 'vitest'
import { DEFAULT_HOLD, emphasisAt, LEVELS } from '@shared/attention.ts'
import { fakeFlags } from './debug-flags.ts'

/** A generator, not a shuffle: every draw is the sequence 0, 0, 0… so the
 *  picker's own spread is what the assertions read, not the randomness. */
const first = () => 0

const NOW = 1_000_000_000

/** Cards born just now. */
const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, bornAt: NOW }))

describe('fakeFlags', () => {
  it('spreads every level over the ids it picks', () => {
    const flags = fakeFlags(ids(20), NOW, 2, first)
    const levels = Object.values(flags).map((f) => f.attention.level)
    expect(levels).toHaveLength(LEVELS.length * 2)
    for (const level of LEVELS) expect(levels.filter((l) => l === level)).toHaveLength(2)
  })

  it('never flags one artifact twice', () => {
    const flags = fakeFlags(ids(20), NOW, 2, first)
    expect(Object.keys(flags)).toHaveLength(new Set(Object.keys(flags)).size)
  })

  it('takes what the wall has when it holds fewer than asked', () => {
    const flags = fakeFlags(ids(3), NOW, 2, first)
    expect(Object.keys(flags)).toHaveLength(3)
    // The spread runs level-first, so a short wall still shows three different
    // treatments rather than three of one.
    expect(new Set(Object.values(flags).map((f) => f.attention.level)).size).toBe(3)
  })

  it('is empty on an empty wall', () => {
    expect(fakeFlags([], NOW, 2, first)).toEqual({})
  })

  it('holds each level for as long as a real flag would, on a card born now', () => {
    const flags = fakeFlags(ids(20), NOW, 2, first)
    for (const flag of Object.values(flags)) {
      expect(flag.attention.holdMs).toBe(DEFAULT_HOLD[flag.attention.level])
    }
  })

  it('stretches a lapsing hold by the card’s age, so soon is not born lapsed on an old card', () => {
    const hour = 3_600_000
    const old = ids(20).map((i) => ({ ...i, bornAt: NOW - hour }))
    const flags = fakeFlags(old, NOW, 2, first)
    const soon = Object.entries(flags).filter(([, f]) => f.attention.level === 'soon')
    expect(soon).toHaveLength(2)
    for (const [, f] of soon) {
      expect(emphasisAt(f.attention, NOW - hour, NOW)).toBe(1)
      expect(f.attention.holdMs).toBe((DEFAULT_HOLD.soon ?? 0) + hour)
    }
    // Levels that hold until dismissed still do.
    for (const f of Object.values(flags)) {
      if (f.attention.level !== 'soon') expect(f.attention.holdMs).toBeNull()
    }
  })

  it('gives every flag a note, so every one of them wears a badge', () => {
    const flags = fakeFlags(ids(20), NOW, 2, first)
    for (const flag of Object.values(flags)) expect(flag.note.length).toBeGreaterThan(0)
  })
})
