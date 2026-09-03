import { describe, expect, it } from 'vitest'
import { framePose } from '@/camera/frame.ts'

const FOV = 35
const UNIT_Z = 0.5 / Math.tan((FOV * Math.PI) / 360)

describe('framePose', () => {
  it('reproduces the unit plane when framing a 1.0-high box at aspect 1', () => {
    const pose = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(pose.z).toBeCloseTo(UNIT_Z, 6)
  })

  it('centres on the box rather than the origin', () => {
    const pose = framePose({ x: 2, y: 4, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(pose.x).toBeCloseTo(2.5, 6)
    expect(pose.y).toBeCloseTo(4.5, 6)
  })

  it('moves closer for a smaller box', () => {
    const big = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    const small = framePose({ x: 0, y: 0, w: 0.25, h: 0.25 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(small.z).toBeLessThan(big.z)
    expect(small.z).toBeCloseTo(big.z / 4, 6)
  })

  it('pulls back for a box wider than the viewport can hold at that height', () => {
    const square = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    const wide = framePose({ x: 0, y: 0, w: 4, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(wide.z).toBeGreaterThan(square.z)
  })

  it('does not pull back for width the viewport already covers', () => {
    const pose = framePose({ x: 0, y: 0, w: 2, h: 1 }, { fovDeg: FOV, aspect: 4, margin: 1 })
    expect(pose.z).toBeCloseTo(UNIT_Z, 6)
  })

  it('applies margin as slack around the box', () => {
    const tight = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    const loose = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1.2 })
    expect(loose.z).toBeCloseTo(tight.z * 1.2, 6)
  })
})
