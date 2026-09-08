import { createQuietGate } from '@/nav/quiet.ts'

/** Which way a gesture walks the hierarchy. */
export type Step = 'in' | 'out'

/** A trackpad pinch is delivered as a wheel event with `ctrlKey` set — macOS
 *  reports it nowhere else — so the two share a handler and differ by scale. */
export type WheelSample = { deltaY: number; ctrlKey: boolean }

export type RailOptions = {
  /** Charge a scroll must accumulate to move a rung. */
  wheelThreshold: number
  /** The same for a pinch, whose deltas run an order of magnitude smaller. */
  pinchThreshold: number
  /** A gap this long ends a gesture and unlocks the rail. */
  quietMs: number
  /** The least time between rungs. The gate stops a flick's tail; this stops a
   *  fast roll of deliberate notches outrunning the camera. */
  floorMs: number
}

/**
 * Turns a stream of wheel samples into discrete rungs, at most one per
 * gesture. The charge is unsigned and thrown away whenever the direction or
 * the input device changes, so a reversal starts a gesture rather than paying
 * off the last one, and a pinch never inherits a scroll's charge.
 */
export function createGestureRail(opts: RailOptions) {
  let charge = 0
  let towards: Step | null = null
  let pinching = false
  let spent = false
  let firedAt = Number.NEGATIVE_INFINITY
  const gate = createQuietGate(opts.quietMs)

  return {
    feed(sample: WheelSample, now: number): Step | null {
      if (sample.deltaY === 0) return null
      // A pinch carries no momentum — the fingers are on the glass and still
      // mean it — so the gesture lock is wrong for one. The floor paces it.
      const tailed = !sample.ctrlKey
      if (gate.feed(now)) {
        spent = false
        charge = 0
      }
      if (spent && tailed) return null

      // Scrolling away and spreading two fingers both mean inward, which is the
      // direction every map on this machine already agrees on.
      const direction: Step = sample.deltaY < 0 ? 'in' : 'out'
      if (direction !== towards || sample.ctrlKey !== pinching) charge = 0
      towards = direction
      pinching = sample.ctrlKey

      charge += Math.abs(sample.deltaY)
      const threshold = pinching ? opts.pinchThreshold : opts.wheelThreshold
      if (charge < threshold) return null
      // Held rather than spent: a stream that has earned a rung takes it the
      // moment the floor lapses, rather than paying for it twice.
      if (now - firedAt < opts.floorMs) return null

      charge = 0
      spent = tailed
      firedAt = now
      return direction
    },
  }
}
