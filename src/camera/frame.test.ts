import { describe, expect, it } from 'vitest'
import { framePose, type FrameView } from '@/camera/frame.ts'

const FOV = 35
const UNIT_Z = 0.5 / Math.tan((FOV * Math.PI) / 360)

const persp = (aspect: number, margin: number): FrameView => ({
  projection: 'perspective',
  fovDeg: FOV,
  standoff: 12,
  aspect,
  margin,
})
const ortho = (aspect: number, margin: number): FrameView => ({
  ...persp(aspect, margin),
  projection: 'orthographic',
})

describe('framePose', () => {
  it('reproduces the unit plane when framing a 1.0-high box at aspect 1', () => {
    const pose = framePose({ x: 0, y: 0, w: 1, h: 1 }, persp(1, 1))
    expect(pose.distance).toBeCloseTo(UNIT_Z, 6)
    expect(pose.halfHeight).toBeCloseTo(0.5, 6)
  })

  it('centres on the box rather than the origin', () => {
    const pose = framePose({ x: 2, y: 4, w: 1, h: 1 }, persp(1, 1))
    expect(pose.x).toBeCloseTo(2.5, 6)
    expect(pose.y).toBeCloseTo(4.5, 6)
  })

  it('moves closer for a smaller box', () => {
    const big = framePose({ x: 0, y: 0, w: 1, h: 1 }, persp(1, 1))
    const small = framePose({ x: 0, y: 0, w: 0.25, h: 0.25 }, persp(1, 1))
    expect(small.distance).toBeLessThan(big.distance)
    expect(small.distance).toBeCloseTo(big.distance / 4, 6)
  })

  it('pulls back for a box wider than the viewport can hold at that height', () => {
    const square = framePose({ x: 0, y: 0, w: 1, h: 1 }, persp(1, 1))
    const wide = framePose({ x: 0, y: 0, w: 4, h: 1 }, persp(1, 1))
    expect(wide.distance).toBeGreaterThan(square.distance)
  })

  it('does not pull back for width the viewport already covers', () => {
    const pose = framePose({ x: 0, y: 0, w: 2, h: 1 }, persp(4, 1))
    expect(pose.distance).toBeCloseTo(UNIT_Z, 6)
  })

  it('applies margin as slack around the box', () => {
    const tight = framePose({ x: 0, y: 0, w: 1, h: 1 }, persp(1, 1))
    const loose = framePose({ x: 0, y: 0, w: 1, h: 1 }, persp(1, 1.2))
    expect(loose.distance).toBeCloseTo(tight.distance * 1.2, 6)
    expect(loose.halfHeight).toBeCloseTo(tight.halfHeight * 1.2, 6)
  })

  it('parks an orthographic camera at its standoff and frames with the frustum', () => {
    const big = framePose({ x: 0, y: 0, w: 1, h: 1 }, ortho(1, 1))
    const small = framePose({ x: 0, y: 0, w: 0.25, h: 0.25 }, ortho(1, 1))
    expect(big.distance).toBe(12)
    expect(small.distance).toBe(12)
    expect(small.halfHeight).toBeCloseTo(big.halfHeight / 4, 6)
  })

  it('frames the same extent under either projection', () => {
    const box = { x: 1, y: 2, w: 3, h: 1.5 }
    const a = framePose(box, persp(1.6, 1.08))
    const b = framePose(box, ortho(1.6, 1.08))
    expect(b.halfHeight).toBeCloseTo(a.halfHeight, 6)
    expect(b.x).toBeCloseTo(a.x, 6)
    expect(b.y).toBeCloseTo(a.y, 6)
  })
})
