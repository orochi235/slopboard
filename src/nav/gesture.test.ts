import { describe, expect, it } from 'vitest'
import { createGestureRail } from '@/nav/gesture.ts'

const OPTS = { wheelThreshold: 60, pinchThreshold: 8, quietMs: 90, floorMs: 320 }
const wheel = (deltaY: number) => ({ deltaY, ctrlKey: false })
const pinch = (deltaY: number) => ({ deltaY, ctrlKey: true })

describe('createGestureRail', () => {
  it('swallows a nudge too small to be meant', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-12), 0)).toBeNull()
  })

  it('goes in once the charge crosses the threshold', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-30), 0)).toBeNull()
    expect(rail.feed(wheel(-30), 10)).toBe('in')
  })

  it('goes out for the other direction', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(70), 0)).toBe('out')
  })

  it('spends the charge on firing, so the next step needs a fresh one', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-70), 0)).toBe('in')
    expect(rail.feed(wheel(-30), 1000)).toBeNull()
  })

  it('discards the charge on a reversal rather than unwinding it', () => {
    const rail = createGestureRail(OPTS)
    rail.feed(wheel(-50), 0)
    expect(rail.feed(wheel(50), 10)).toBeNull()
    // A signed rail would sit at zero here, owing a full 60 outward. The flip
    // threw the inward charge away instead, so this is already 50 of the way.
    expect(rail.feed(wheel(15), 20)).toBe('out')
  })

  it('fires a pinch on its own smaller threshold', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(pinch(-9), 0)).toBe('in')
  })

  it('does not fire a wheel of pinch magnitude', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-9), 0)).toBeNull()
  })

  it('starts a new charge when the gesture changes hands mid-rail', () => {
    const rail = createGestureRail(OPTS)
    rail.feed(wheel(-55), 0)
    // 55 of wheel is most of a wheel step and many pinch steps; carrying it
    // across would make a fingertip pinch inherit a scroll's charge.
    expect(rail.feed(pinch(-4), 10)).toBeNull()
  })

  it('ignores the momentum tail behind a step it already fired', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-70), 0)).toBe('in')
    expect(rail.feed(wheel(-70), 100)).toBeNull()
    expect(rail.feed(wheel(-70), 200)).toBeNull()
  })

  it('banks nothing behind a spent gesture, however long the tail runs', () => {
    const rail = createGestureRail(OPTS)
    rail.feed(wheel(-70), 0)
    for (let t = 20; t < 300; t += 20) rail.feed(wheel(-70), t)
    expect(rail.feed(wheel(-20), 320)).toBeNull()
  })

  it('fires again for a deliberate second gesture after the stream goes quiet', () => {
    const rail = createGestureRail(OPTS)
    rail.feed(wheel(-70), 0)
    expect(rail.feed(wheel(-70), 400)).toBe('in')
  })

  it('ignores a zero delta, which a browser sends at the end of a fling', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(0), 0)).toBeNull()
    expect(rail.feed(wheel(-70), 10)).toBe('in')
  })

  it('still gathers a trackpad stream at the lowest quietMs the slider offers', () => {
    // Under about a frame every event reads as a fresh gesture, which zeroes the
    // charge before a stream of small deltas can ever reach the threshold — so
    // the slider's floor is a navigable wall, not the most responsive one.
    const rail = createGestureRail({ ...OPTS, quietMs: 40 })
    let fired = 0
    for (let i = 0; i < 120; i++) if (rail.feed(wheel(-12), i * 16)) fired++
    expect(fired).toBe(1)
  })

  it('paces a fast roll of deliberate notches', () => {
    // Every notch is its own gesture, so the gate passes all of them and the
    // floor is the only thing between a brisk roll and the bottom of the wall.
    const rail = createGestureRail(OPTS)
    let fired = 0
    for (let i = 0; i < 12; i++) if (rail.feed(wheel(-120), i * 150)) fired++
    expect(fired).toBe(4)
  })

  it('takes the rung on the first event past the floor, not a fresh charge', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-70), 0)).toBe('in')
    // Earned again at 200ms but refused by the floor. Within the one stream the
    // charge is held, so the rung lands as the floor lapses rather than the
    // hand having to pay for it twice.
    expect(rail.feed(wheel(-70), 200)).toBeNull()
    expect(rail.feed(wheel(-10), 250)).toBeNull()
    expect(rail.feed(wheel(-10), 330)).toBe('in')
  })

  it('does not hold a pinch to one rung, having no momentum to outrun', () => {
    // Two fingers on the glass are still moving and still mean it; only the
    // floor paces a spread.
    const rail = createGestureRail(OPTS)
    let fired = 0
    for (let i = 0; i < 125; i++) if (rail.feed(pinch(-3), i * 16)) fired++
    expect(fired).toBeGreaterThan(1)
  })

  it('gives a hard flick one rung and no more', () => {
    const rail = createGestureRail(OPTS)
    let fired = 0
    // 50 frames of a decaying throw, which under a time-based cooldown was
    // worth a rung every time the dead time lapsed.
    for (let i = 0; i < 50; i++) if (rail.feed(wheel(-120), i * 16)) fired++
    expect(fired).toBe(1)
  })

  it('does not let a spent gesture buy a step by reversing', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-70), 0)).toBe('in')
    expect(rail.feed(wheel(90), 16)).toBeNull()
    expect(rail.feed(wheel(90), 32)).toBeNull()
  })

  it('gives the next flick its own rung once the hand stops', () => {
    const rail = createGestureRail(OPTS)
    let fired = 0
    for (let i = 0; i < 20; i++) if (rail.feed(wheel(-120), i * 16)) fired++
    for (let i = 0; i < 20; i++) if (rail.feed(wheel(-120), 1000 + i * 16)) fired++
    expect(fired).toBe(2)
  })
})
