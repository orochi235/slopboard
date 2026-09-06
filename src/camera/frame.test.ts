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

describe('framing around the sidebar', () => {
  const view = {
    projection: 'orthographic' as const,
    fovDeg: 50,
    standoff: 2,
    aspect: 2,
    margin: 1,
  }
  const box = { x: 0, y: 0, w: 4, h: 1 }

  it('shows the same wall in less width, so nothing is cropped', () => {
    const full = framePose(box, view)
    const inset = framePose(box, { ...view, insetRight: 0.25 })
    // Width binds here, so covering a quarter of the canvas has to zoom out by
    // exactly the reciprocal to keep the whole box on the visible part.
    expect(inset.halfHeight).toBeCloseTo(full.halfHeight / 0.75, 6)
  })

  it('centers the wall in the part the sidebar leaves, not the whole canvas', () => {
    const inset = framePose(box, { ...view, insetRight: 0.25 })
    // The camera moves right so the content lands left of the canvas center.
    const shift = inset.halfHeight * view.aspect * 0.25
    expect(inset.x).toBeCloseTo(box.x + box.w / 2 + shift, 6)
  })

  it("leaves the right edge of the box clear of the sidebar's inner edge", () => {
    const inset = framePose(box, { ...view, insetRight: 0.25 })
    const halfWidth = inset.halfHeight * view.aspect
    const sidebarInnerEdge = inset.x + halfWidth - 2 * halfWidth * 0.25
    expect(box.x + box.w).toBeLessThanOrEqual(sidebarInnerEdge + 1e-6)
  })

  it('is unchanged when the sidebar is closed', () => {
    expect(framePose(box, { ...view, insetRight: 0 })).toEqual(framePose(box, view))
  })

  it('refuses an inset wider than the viewport rather than framing to infinity', () => {
    const silly = framePose(box, { ...view, insetRight: 5 })
    expect(Number.isFinite(silly.halfHeight)).toBe(true)
    expect(Number.isFinite(silly.x)).toBe(true)
  })
})
