import { describe, expect, it } from 'vitest'
import { parseDuration } from './duration.ts'

describe('parseDuration', () => {
  it('assumes seconds when no unit is given', () => {
    expect(parseDuration('60')).toBe(60_000)
    expect(parseDuration('0')).toBe(0)
  })

  it('reads the units', () => {
    expect(parseDuration('90s')).toBe(90_000)
    expect(parseDuration('5m')).toBe(300_000)
    expect(parseDuration('24h')).toBe(86_400_000)
    expect(parseDuration('2d')).toBe(172_800_000)
  })

  it('accepts a fraction, so 0.5h is not a rounding trap', () => {
    expect(parseDuration('0.5h')).toBe(1_800_000)
  })

  it('is case-insensitive and ignores surrounding space', () => {
    expect(parseDuration(' 5M ')).toBe(300_000)
  })

  it('rejects what it cannot read rather than guessing', () => {
    for (const bad of ['', 'soon', '5x', '-1', 'm5', '5 m', 'NaN']) {
      expect(parseDuration(bad)).toBeNull()
    }
  })
})
