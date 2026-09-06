import { describe, expect, it } from 'vitest'
import { axisScreens } from './axes.ts'

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('axisScreens', () => {
  it('puts x across and y up on a head-on wall', () => {
    const [x, y, z] = axisScreens(0, 0)
    near(x.x, 1)
    near(x.y, 0)
    near(y.x, 0)
    near(y.y, 1)
    // Straight at the camera, so it projects to nothing — which is exactly the
    // reading that makes z hard to name from a head-on wall.
    near(z.x, 0)
    near(z.y, 0)
  })

  it('names z as the one pointing at the viewer, head-on', () => {
    const [, , z] = axisScreens(0, 0)
    expect(z.depth).toBeLessThan(0)
  })

  it('swings z across the screen once the wall is turned a quarter', () => {
    const [x, , z] = axisScreens(90, 0)
    near(z.x, -1)
    near(z.y, 0)
    // And x is now the one aimed at the camera.
    near(x.x, 0)
    near(x.y, 0)
  })

  it('keeps y up when the camera is lifted, and shortens it', () => {
    const [, y] = axisScreens(0, 45)
    near(y.x, 0)
    expect(y.y).toBeGreaterThan(0)
    expect(y.y).toBeLessThan(1)
  })

  it('returns unit-length axes in three dimensions, so nothing is scaled twice', () => {
    for (const axis of axisScreens(33, 17)) {
      near(Math.hypot(axis.x, axis.y, axis.depth), 1)
    }
  })
})
