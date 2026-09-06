import { describe, expect, it } from 'vitest'
import { DEFAULT_HOLD, emphasisAt, parseAttention } from './attention.ts'

describe('parseAttention', () => {
  it('reads a bare level and holds it for that level default', () => {
    expect(parseAttention('look')).toEqual({ level: 'look', holdMs: null })
    expect(parseAttention('problem')).toEqual({ level: 'problem', holdMs: null })
  })

  it('lapses only the deadline level on its own, since a passed deadline stops asking', () => {
    expect(parseAttention('soon')).toEqual({ level: 'soon', holdMs: DEFAULT_HOLD.soon })
    expect(DEFAULT_HOLD.soon).not.toBeNull()
    for (const level of ['look', 'urgent', 'problem'] as const) {
      expect(DEFAULT_HOLD[level]).toBeNull()
    }
  })

  it('reads every level the wall knows', () => {
    for (const level of ['look', 'soon', 'urgent', 'problem'] as const) {
      expect(parseAttention(level)?.level).toBe(level)
    }
  })

  it('reads a bare duration as the default level', () => {
    expect(parseAttention('30m')).toEqual({ level: 'look', holdMs: 1_800_000 })
  })

  it('reads a level and a duration together', () => {
    expect(parseAttention('look:90s')).toEqual({ level: 'look', holdMs: 90_000 })
  })

  it('holds until dismissed, which is a null rather than a very large number', () => {
    expect(parseAttention('until-dismissed')).toEqual({ level: 'look', holdMs: null })
    expect(parseAttention('look:until-dismissed')).toEqual({ level: 'look', holdMs: null })
  })

  it('rejects what it cannot read rather than guessing a level', () => {
    // A typo must not become a silent flag at the default strength, and it must
    // not become a level of its own the moment one is added.
    for (const bad of ['', '  ', 'shout', 'look:soon', 'look:5x', ':30m', 'look:']) {
      expect(parseAttention(bad)).toBeNull()
    }
  })

  it('ignores case and surrounding space, like every other value written by hand', () => {
    expect(parseAttention(' LOOK:5M ')).toEqual({ level: 'look', holdMs: 300_000 })
  })
})

describe('emphasisAt', () => {
  const held = { level: 'look', holdMs: 1000 } as const

  it('is full for the whole hold and gone after it', () => {
    expect(emphasisAt(held, 0, 0)).toBe(1)
    expect(emphasisAt(held, 0, 999)).toBe(1)
    expect(emphasisAt(held, 0, 1000)).toBe(0)
    expect(emphasisAt(held, 0, 60_000)).toBe(0)
  })

  it('never lapses when the hold is until-dismissed', () => {
    const forever = { level: 'look', holdMs: null } as const
    expect(emphasisAt(forever, 0, 86_400_000)).toBe(1)
  })

  it('is nothing at all for an unflagged item', () => {
    expect(emphasisAt(null, 0, 0)).toBe(0)
    expect(emphasisAt(undefined, 0, 0)).toBe(0)
  })

  it('does not go loud again if the clock steps backwards', () => {
    expect(emphasisAt(held, 5000, 0)).toBe(1)
  })
})
