import { describe, expect, it } from 'vitest'
import { createReveal } from '@/textures/reveal.ts'

const opts = { holdMs: 1000, fadeMs: 200 }

describe('createReveal', () => {
  it('holds the wall dark while the fronts are still decoding', () => {
    const reveal = createReveal()
    expect(reveal({ now: 0, fronts: 10, ready: 0, ...opts })).toBe(0)
    expect(reveal({ now: 500, fronts: 10, ready: 9, ...opts })).toBe(0)
  })

  it('opens as soon as every front has its picture', () => {
    const reveal = createReveal()
    reveal({ now: 0, fronts: 10, ready: 0, ...opts })
    expect(reveal({ now: 400, fronts: 10, ready: 10, ...opts })).toBe(0)
    expect(reveal({ now: 500, fronts: 10, ready: 10, ...opts })).toBeCloseTo(0.5)
    expect(reveal({ now: 600, fronts: 10, ready: 10, ...opts })).toBe(1)
  })

  it('opens on the hold when a front never decodes', () => {
    const reveal = createReveal()
    reveal({ now: 0, fronts: 10, ready: 9, ...opts })
    expect(reveal({ now: 999, fronts: 10, ready: 9, ...opts })).toBe(0)
    expect(reveal({ now: 1000, fronts: 10, ready: 9, ...opts })).toBe(0)
    expect(reveal({ now: 1200, fronts: 10, ready: 9, ...opts })).toBe(1)
  })

  it('does not reopen once it is open', () => {
    const reveal = createReveal()
    reveal({ now: 0, fronts: 1, ready: 1, ...opts })
    reveal({ now: 300, fronts: 1, ready: 1, ...opts })
    // A pile arriving later drops `ready` below `fronts`; the wall is already up.
    expect(reveal({ now: 400, fronts: 30, ready: 1, ...opts })).toBe(1)
  })

  it('waits out the hold rather than opening on an empty wall', () => {
    const reveal = createReveal()
    expect(reveal({ now: 0, fronts: 0, ready: 0, ...opts })).toBe(0)
    expect(reveal({ now: 1000, fronts: 0, ready: 0, ...opts })).toBe(0)
    expect(reveal({ now: 1200, fronts: 0, ready: 0, ...opts })).toBe(1)
  })

  it('is off entirely at a zero hold', () => {
    const reveal = createReveal()
    expect(reveal({ now: 0, fronts: 10, ready: 0, holdMs: 0, fadeMs: 200 })).toBe(1)
  })
})
