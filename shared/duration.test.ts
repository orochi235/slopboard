import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, parseDuration } from './duration.ts'

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

describe('formatDuration', () => {
  it('writes the largest whole unit it fits, the way a person would', () => {
    expect(formatDuration(90_000)).toBe('90s')
    expect(formatDuration(300_000)).toBe('5m')
    expect(formatDuration(28_800_000)).toBe('8h')
    expect(formatDuration(172_800_000)).toBe('2d')
  })

  it('drops to the unit below rather than writing a fraction', () => {
    expect(formatDuration(5_400_000)).toBe('90m')
    expect(formatDuration(1500)).toBe('1500ms')
  })

  it('round-trips through parseDuration', () => {
    for (const ms of [1000, 90_000, 300_000, 3_600_000, 28_800_000, 604_800_000])
      expect(parseDuration(formatDuration(ms))).toBe(ms)
  })
})

describe('formatClock', () => {
  it('writes a runtime the way a player does', () => {
    expect(formatClock(12_000)).toBe('0:12')
    expect(formatClock(243_000)).toBe('4:03')
    expect(formatClock(3_753_000)).toBe('1:02:33')
  })

  it('pads the minute only once there is an hour above it', () => {
    expect(formatClock(300_000)).toBe('5:00')
    expect(formatClock(3_600_000)).toBe('1:00:00')
  })

  it('floors, so a badge never claims a second the video lacks', () => {
    expect(formatClock(11_999)).toBe('0:11')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-5)).toBe('0:00')
  })
})
