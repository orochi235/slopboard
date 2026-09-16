import { describe, expect, it } from 'vitest'
import { BUCKETS, bucketRange, filterFrom, histogram, keptBy, resolve, sameIds, spanOf } from './time-filter.ts'

const NOW = 1_000_000_000

describe('spanOf', () => {
  it('reaches back to a whole step past the oldest artifact, ending now', () => {
    expect(spanOf([NOW - 5000, NOW - 900], NOW)).toEqual({ from: NOW - 900_000, to: NOW })
    expect(spanOf([NOW - 2 * 3_600_000], NOW)).toEqual({ from: NOW - 3 * 3_600_000, to: NOW })
  })

  it('keeps its length as the clock ticks, so a trailing window holds still on it', () => {
    const born = [NOW - 5000]
    const a = spanOf(born, NOW)
    const b = spanOf(born, NOW + 60_000)
    expect(b.to - b.from).toBe(a.to - a.from)
  })

  it('rounds past a month in whole months rather than running out of steps', () => {
    const span = spanOf([NOW - 45 * 86_400_000], NOW)
    expect(span.to - span.from).toBe(60 * 86_400_000)
  })

  it('gives an empty wall an hour to draw, rather than a zero-width axis', () => {
    const span = spanOf([], NOW)
    expect(span.to).toBe(NOW)
    expect(span.to - span.from).toBe(3_600_000)
  })
})

describe('histogram', () => {
  it('counts each artifact into one bin', () => {
    const bins = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { from: 0, to: 10 }, 5)
    expect(bins).toEqual([2, 2, 2, 2, 2])
  })

  it('puts an artifact landing exactly at the end in the last bin, not past it', () => {
    const bins = histogram([10], { from: 0, to: 10 }, 5)
    expect(bins[4]).toBe(1)
    expect(bins).toHaveLength(5)
  })

  it('ignores anything outside the span rather than clamping it inward', () => {
    expect(histogram([-5, 15], { from: 0, to: 10 }, 5)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('keptBy', () => {
  it('keeps what falls inside the range, ends included', () => {
    expect(keptBy(50, { from: 50, to: 100 })).toBe(true)
    expect(keptBy(100, { from: 50, to: 100 })).toBe(true)
    expect(keptBy(49, { from: 50, to: 100 })).toBe(false)
  })

  it('keeps everything when there is no range, so an unset filter hides nothing', () => {
    expect(keptBy(0, null)).toBe(true)
  })
})

describe('bucketRange', () => {
  it('turns a named bucket into a window trailing now', () => {
    expect(bucketRange('hour')).toEqual({ last: 3_600_000 })
    const range = resolve(bucketRange('hour'), NOW)
    expect(range?.to).toBe(NOW)
    expect(NOW - (range?.from ?? 0)).toBe(3_600_000)
  })

  it('names every bucket it offers', () => {
    for (const bucket of BUCKETS) expect(bucket.label.length).toBeGreaterThan(0)
  })
})

describe('filterFrom', () => {
  const span = { from: NOW - 600_000, to: NOW }

  it('trails now when the right thumb sits at the end of the axis, so the window moves with the clock', () => {
    const filter = filterFrom(NOW - 60_000, NOW, span, 1000)
    expect(filter).toEqual({ last: 60_000 })
    expect(resolve(filter, NOW + 5000)).toEqual({ from: NOW - 55_000, to: NOW + 5000 })
  })

  it('holds still in time when the right thumb is set in the past', () => {
    const filter = filterFrom(NOW - 60_000, NOW - 30_000, span, 1000)
    expect(resolve(filter, NOW + 5000)).toEqual({ from: NOW - 60_000, to: NOW - 30_000 })
  })

  it('counts a thumb within one step of the end as at the end, since the axis ticked during the drag', () => {
    expect(filterFrom(NOW - 60_000, NOW - 999, span, 1000)).toEqual({ last: 60_000 })
  })
})

describe('resolve', () => {
  it('leaves no filter as no filter', () => {
    expect(resolve(null, NOW)).toBeNull()
  })
})

describe('sameIds', () => {
  it('compares membership, not identity', () => {
    expect(sameIds(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(sameIds(new Set(['a']), new Set(['a', 'b']))).toBe(false)
  })
})
