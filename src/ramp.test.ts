import { describe, expect, it } from 'vitest'
import { rampAt, rampOf, rampTo } from '@/ramp.ts'

const MS = 400

describe('rampAt', () => {
  it('sits at its value before anything aims it', () => {
    expect(rampAt(rampOf(1), 5_000, MS)).toBe(1)
  })

  it('starts at the old value and lands on the new one', () => {
    const ramp = rampTo(rampOf(1), 0.45, 1_000, MS)
    expect(rampAt(ramp, 1_000, MS)).toBe(1)
    expect(rampAt(ramp, 1_400, MS)).toBeCloseTo(0.45)
  })

  it('holds the target past the end rather than overshooting', () => {
    const ramp = rampTo(rampOf(1), 0.45, 1_000, MS)
    expect(rampAt(ramp, 9_000, MS)).toBeCloseTo(0.45)
  })

  it('eases out, so most of the travel is early', () => {
    const ramp = rampTo(rampOf(0), 1, 0, MS)
    expect(rampAt(ramp, MS / 2, MS)).toBeGreaterThan(0.5)
  })

  // A zero duration is a legal tuning of camera.moveMs, and dividing by it
  // would put the chip at NaN scale for the rest of the session.
  it('snaps when there is no duration to spend', () => {
    expect(rampAt(rampTo(rampOf(1), 0.45, 1_000, 0), 1_000, 0)).toBe(0.45)
  })
})

describe('rampTo', () => {
  it('leaves from where it actually is, not from where it was going', () => {
    const out = rampTo(rampOf(1), 0.45, 0, MS)
    const reversed = rampTo(out, 1, MS / 2, MS)
    // Mid-flight, so it turns around from a value strictly between the two.
    expect(reversed.from).toBeGreaterThan(0.45)
    expect(reversed.from).toBeLessThan(1)
  })

  it('is a no-op when aimed where it already goes, so a frame cannot restart it', () => {
    const out = rampTo(rampOf(1), 0.45, 0, MS)
    expect(rampTo(out, 0.45, 200, MS)).toBe(out)
  })
})
