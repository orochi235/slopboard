import { describe, expect, it } from 'vitest'
import { ago } from './age.ts'

describe('ago', () => {
  it('counts seconds under a minute', () => {
    expect(ago(0)).toBe('0s')
    expect(ago(45_000)).toBe('45s')
  })

  it('counts whole minutes up to an hour', () => {
    expect(ago(60_000)).toBe('1m')
    expect(ago(3_540_000)).toBe('59m')
  })

  it('counts hours up to a day', () => {
    expect(ago(3_600_000)).toBe('1h')
    expect(ago(82_800_000)).toBe('23h')
  })

  it('counts days past that', () => {
    expect(ago(86_400_000)).toBe('1d')
    expect(ago(950_400_000)).toBe('11d')
  })

  it('reads a clock that ran backwards as nothing rather than as a negative', () => {
    expect(ago(-5000)).toBe('0s')
  })
})
