import { describe, expect, it } from 'vitest'
import { orbitOffset } from '@/camera/orbit.ts'

describe('orbitOffset', () => {
  it('is straight down -Z at zero angle, which is the head-on wall', () => {
    const o = orbitOffset(0, 0, 5)
    expect(o.x).toBeCloseTo(0, 6)
    expect(o.y).toBeCloseTo(0, 6)
    expect(o.z).toBeCloseTo(5, 6)
  })

  it('swings the camera right with yaw and lifts it with pitch', () => {
    expect(orbitOffset(90, 0, 5).x).toBeCloseTo(5, 6)
    expect(orbitOffset(0, 90, 5).y).toBeCloseTo(5, 6)
  })

  it('keeps the camera at the distance given, whatever the angle', () => {
    const o = orbitOffset(37, -21, 3)
    expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(3, 6)
  })
})
