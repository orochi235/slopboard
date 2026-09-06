import { describe, expect, it } from 'vitest'
import { BUCKETS, bucketRange, histogram, keptBy, spanOf } from './time-filter.ts'

const NOW = 1_000_000_000

describe('spanOf', () => {
  it('runs from the oldest artifact to now', () => {
    expect(spanOf([NOW - 5000, NOW - 900], NOW)).toEqual({ from: NOW - 5000, to: NOW })
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
  it('turns a named bucket into a range ending now', () => {
    const range = bucketRange('hour', NOW)
    expect(range.to).toBe(NOW)
    expect(NOW - range.from).toBe(3_600_000)
  })

  it('names every bucket it offers', () => {
    for (const bucket of BUCKETS) expect(bucket.label.length).toBeGreaterThan(0)
  })
})
