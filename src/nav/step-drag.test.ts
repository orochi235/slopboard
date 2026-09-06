import { describe, expect, it } from 'vitest'
import { stepFromDrag } from './step-drag.ts'

const base = { x: 0, y: 0, z: 0 }
/** One world unit per hundred pixels, so a drag reads as a round number. */
const worldPerPx = 0.01

describe('stepFromDrag', () => {
  it('turns a drag right on a head-on wall into a lean along +x', () => {
    const next = stepFromDrag({ base, dxPx: 100, dyPx: 0, rank: 1, worldPerPx, yawDeg: 0, pitchDeg: 0 })
    expect(next.x).toBeCloseTo(1)
    expect(next.y).toBeCloseTo(0)
  })

  it('turns a drag up into a lean along +y, since the world grows y up', () => {
    const next = stepFromDrag({ base, dxPx: 0, dyPx: -100, rank: 1, worldPerPx, yawDeg: 0, pitchDeg: 0 })
    expect(next.y).toBeCloseTo(1)
    expect(next.x).toBeCloseTo(0)
  })

  it('spreads the drag over the ranks, because what is dragged is one rank', () => {
    const next = stepFromDrag({ base, dxPx: 100, dyPx: 0, rank: 4, worldPerPx, yawDeg: 0, pitchDeg: 0 })
    expect(next.x).toBeCloseTo(0.25)
  })

  it('adds to where the step already was, so a drag is a nudge not a reset', () => {
    const next = stepFromDrag({
      base: { x: 0.5, y: -0.25, z: -0.04 },
      dxPx: 100,
      dyPx: 0,
      rank: 1,
      worldPerPx,
      yawDeg: 0,
      pitchDeg: 0,
    })
    expect(next.x).toBeCloseTo(1.5)
    expect(next.y).toBeCloseTo(-0.25)
    expect(next.z).toBeCloseTo(-0.04)
  })

  it('reads a sideways drag on a turned wall as depth, not as x', () => {
    // A quarter turn puts the world's z across the screen, so dragging right
    // moves the pile along z and leaves x alone. Getting this wrong is the
    // whole reason the drag goes through the camera basis.
    const next = stepFromDrag({ base, dxPx: 100, dyPx: 0, rank: 1, worldPerPx, yawDeg: 90, pitchDeg: 0 })
    expect(next.x).toBeCloseTo(0)
    expect(next.z).toBeCloseTo(-1)
  })

  it('fans the pile out behind the front card, which has no rank of its own', () => {
    // Rank 0 does not move with the step at all, so a drag on it cannot be
    // divided by its rank. It spreads over one instead: the card stays under
    // the hand and the pile opens out behind it, which is what the gesture
    // looks like it should do.
    const next = stepFromDrag({ base, dxPx: 100, dyPx: 0, rank: 0, worldPerPx, yawDeg: 0, pitchDeg: 0 })
    expect(next.x).toBeCloseTo(1)
  })
})
