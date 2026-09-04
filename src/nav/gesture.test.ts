import { describe, expect, it } from 'vitest'
import { createGestureRail } from '@/nav/gesture.ts'

const OPTS = { wheelThreshold: 60, pinchThreshold: 8, cooldownMs: 300 }
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

  it('banks nothing during the cooldown, so the tail does not fire the moment it lapses', () => {
    const rail = createGestureRail(OPTS)
    rail.feed(wheel(-70), 0)
    for (let t = 20; t < 300; t += 20) rail.feed(wheel(-70), t)
    expect(rail.feed(wheel(-20), 320)).toBeNull()
  })

  it('fires again for a deliberate second gesture after the cooldown', () => {
    const rail = createGestureRail(OPTS)
    rail.feed(wheel(-70), 0)
    expect(rail.feed(wheel(-70), 400)).toBe('in')
  })

  it('ignores a zero delta, which a browser sends at the end of a fling', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(0), 0)).toBeNull()
    expect(rail.feed(wheel(-70), 10)).toBe('in')
  })
})
