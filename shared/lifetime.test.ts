import { describe, expect, it } from 'vitest'
import { formatLifetime, isEternal, isHold, lifetimeMs, parseLifetime } from './lifetime.ts'

describe('lifetimeMs', () => {
  it('passes a duration through, so the sweeper needs no case for it', () => {
    expect(lifetimeMs(300_000)).toBe(300_000)
  })

  it('is infinite for either hold, which is what takes it off the clock', () => {
    expect(lifetimeMs('indefinite')).toBe(Infinity)
    expect(lifetimeMs('eternal')).toBe(Infinity)
  })

  it('never expires against a real clock', () => {
    const born = 0
    const now = Date.now()
    expect(born < now - lifetimeMs('indefinite')).toBe(false)
    expect(born < now - lifetimeMs('eternal')).toBe(false)
  })
})

describe('isEternal', () => {
  it('separates the two holds, which is the only thing that does', () => {
    expect(isEternal('eternal')).toBe(true)
    expect(isEternal('indefinite')).toBe(false)
    expect(isEternal(300_000)).toBe(false)
    expect(isEternal(undefined)).toBe(false)
  })
})

describe('parseLifetime and formatLifetime', () => {
  it('reads a hold by its own word', () => {
    expect(parseLifetime('indefinite')).toBe('indefinite')
    expect(parseLifetime(' eternal ')).toBe('eternal')
  })

  it('reads a duration the way SLOP_TTL takes it', () => {
    expect(parseLifetime('8h')).toBe(28_800_000)
    expect(parseLifetime('90')).toBe(90_000)
  })

  it('rejects what it cannot read rather than guessing', () => {
    for (const bad of ['', 'forever', 'never', '5x', 'ETERNAL']) {
      expect(parseLifetime(bad)).toBeNull()
    }
  })

  it('round-trips both kinds', () => {
    for (const l of [300_000, 28_800_000, 'indefinite', 'eternal'] as const) {
      expect(parseLifetime(formatLifetime(l))).toEqual(l)
    }
  })
})

describe('isHold', () => {
  it('is the guard the daemon reads a stored record with', () => {
    expect(isHold('eternal')).toBe(true)
    expect(isHold('8h')).toBe(false)
    expect(isHold(300_000)).toBe(false)
    expect(isHold(null)).toBe(false)
  })
})
