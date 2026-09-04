import { describe, expect, it } from 'vitest'
import { ramp } from '@/arrangements/slots.ts'

describe('ramp', () => {
  it('maps the window onto 0..1', () => {
    expect(ramp(0.88, 0.88, 1)).toBe(0)
    expect(ramp(1, 0.88, 1)).toBe(1)
    expect(ramp(0.94, 0.88, 1)).toBeCloseTo(0.5)
  })

  it('clamps outside the window', () => {
    expect(ramp(0.2, 0.88, 1)).toBe(0)
    expect(ramp(2, 0.88, 1)).toBe(1)
  })

  it('reads a window given backwards as the same window, not as a reversed one', () => {
    // Dragging fade.to below fade.from used to inverse the whole wall: fresh
    // cards at opacity 0 and dead ones solid.
    expect(ramp(0.2, 0.88, 0.5)).toBe(0)
    expect(ramp(1, 0.88, 0.5)).toBe(1)
    expect(ramp(0.69, 0.88, 0.5)).toBeCloseTo(ramp(0.69, 0.5, 0.88))
  })

  it('treats a window with no width as a step, rather than dividing by zero', () => {
    expect(ramp(0.87, 0.88, 0.88)).toBe(0)
    expect(ramp(0.88, 0.88, 0.88)).toBe(1)
    expect(ramp(0.89, 0.88, 0.88)).toBe(1)
  })

  it('never returns NaN, whatever the panel hands it', () => {
    const bounds = [0, 0.5, 0.88, 1]
    for (const a of bounds) {
      for (const b of bounds) {
        for (const v of [0, 0.25, 0.5, 0.88, 1]) {
          expect(Number.isNaN(ramp(v, a, b))).toBe(false)
        }
      }
    }
  })
})
