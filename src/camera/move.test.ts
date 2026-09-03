import { describe, expect, it } from 'vitest'
import type { Pose } from '@/camera/frame.ts'
import { poseAt } from '@/camera/move.ts'

const from: Pose = { x: 0, y: 0, distance: 4, halfHeight: 2 }
const to: Pose = { x: 2, y: 1, distance: 1, halfHeight: 0.5 }
const move = { from, to, startedAt: 1000, durationMs: 400 }

describe('poseAt', () => {
  it('is exactly the start pose before the move begins', () => {
    expect(poseAt(move, 1000)).toEqual(from)
  })

  it('is exactly the end pose once the duration has elapsed', () => {
    expect(poseAt(move, 1400)).toEqual(to)
  })

  it('stays at the end pose afterwards rather than overshooting', () => {
    expect(poseAt(move, 99_999)).toEqual(to)
  })

  it('is monotonic on every axis through the move', () => {
    const samples = [0, 100, 200, 300, 400].map((dt) => poseAt(move, 1000 + dt))
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.x).toBeGreaterThanOrEqual(samples[i - 1]!.x)
      expect(samples[i]!.distance).toBeLessThanOrEqual(samples[i - 1]!.distance)
      expect(samples[i]!.halfHeight).toBeLessThanOrEqual(samples[i - 1]!.halfHeight)
    }
  })

  it('eases the framed extent too, so an orthographic zoom is not a jump cut', () => {
    expect(poseAt(move, 1200).halfHeight).toBeLessThan(1.25)
    expect(poseAt(move, 1200).halfHeight).toBeGreaterThan(0.5)
  })

  it('eases out — past halfway by the time it is halfway through', () => {
    expect(poseAt(move, 1200).x).toBeGreaterThan(1)
  })

  it('is a jump cut at zero duration rather than a divide by zero', () => {
    expect(poseAt({ ...move, durationMs: 0 }, 1000)).toEqual(to)
  })
})
