import { describe, expect, it } from 'vitest'
import { hatchRotation, svgHatchSlope, wallHatchSlope } from '@/nav/hatch-angle.ts'

describe('hatchRotation', () => {
  // Every quadrant, because the mirror is not a special case of one of them.
  const angles = [10, 46, 89, 91, 120, 170, 200, 315]

  it('draws the plan at the slope the wall rules', () => {
    for (const deg of angles) {
      expect(svgHatchSlope(hatchRotation(deg))).toBeCloseTo(wallHatchSlope(deg), 10)
    }
  })

  it('would mirror the wall if the angle were passed through', () => {
    for (const deg of angles) {
      expect(svgHatchSlope(deg)).toBeCloseTo(-wallHatchSlope(deg), 10)
    }
  })

  it('leans the way the shader does at the wall default', () => {
    // 46° rules lines falling left to right; the plan has to fall with them.
    expect(wallHatchSlope(46)).toBeLessThan(0)
    expect(svgHatchSlope(hatchRotation(46))).toBeLessThan(0)
  })
})
