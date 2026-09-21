import { describe, expect, it } from 'vitest'
import { chipHeightOn } from '@/chip-size.ts'

/** The age chip's own shape: `4m` in the wall's badge face, wider than tall. */
const AGE = 2.4
const room = (over: Partial<Parameters<typeof chipHeightOn>[0]> = {}) => ({
  full: 0.03,
  cardW: 1,
  cardH: 1,
  share: 0.16,
  aspect: AGE,
  ...over,
})

describe('chipHeightOn', () => {
  it('leaves a card with room for it at its full size', () => {
    expect(chipHeightOn(room())).toBe(0.03)
  })

  it('shrinks with a card too small to wear one whole', () => {
    expect(chipHeightOn(room({ cardW: 0.1, cardH: 0.1 }))).toBeCloseTo(0.016, 6)
  })

  it('measures a card by its area, not its shorter side', () => {
    // The complaint this rule exists for: a 3.2:1 panorama and a square of the
    // same area are the same size of thumbnail, and read their age alike.
    const wide = chipHeightOn(room({ cardW: 0.32, cardH: 0.1 }))
    const square = chipHeightOn(room({ cardW: 0.179, cardH: 0.179 }))
    expect(wide).toBeCloseTo(square, 3)
  })

  it('keeps a chip off the ends of a card too narrow to hold it', () => {
    // A sliver has the area for a plate that would hang over both its edges.
    const sliver = chipHeightOn(room({ cardW: 0.05, cardH: 1 }))
    expect(sliver * AGE).toBeLessThanOrEqual(0.05)
  })

  it('never stands taller than a share of the card it annotates', () => {
    const squat = chipHeightOn(room({ cardW: 4, cardH: 0.02 }))
    expect(squat).toBeLessThanOrEqual(0.02 * 0.4)
  })
})
