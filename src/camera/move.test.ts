import { describe, expect, it } from 'vitest'
import { poseAt } from '@/camera/move.ts'

const from = { x: 0, y: 0, z: 4 }
const to = { x: 2, y: 1, z: 1 }
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
      expect(samples[i]!.z).toBeLessThanOrEqual(samples[i - 1]!.z)
    }
  })

  it('eases out — past halfway by the time it is halfway through', () => {
    expect(poseAt(move, 1200).x).toBeGreaterThan(1)
  })

  it('is a jump cut at zero duration rather than a divide by zero', () => {
    expect(poseAt({ ...move, durationMs: 0 }, 1000)).toEqual(to)
  })
})
