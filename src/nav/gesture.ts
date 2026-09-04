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
  /** Dead time after a step. Momentum scrolling keeps delivering for most of a
   *  second, and without this one flick walks the whole hierarchy. */
  cooldownMs: number
}

/**
 * Turns a stream of wheel samples into discrete rungs. The charge is unsigned
 * and thrown away whenever the direction or the input device changes, so a
 * reversal starts a gesture rather than paying off the last one, and a pinch
 * never inherits a scroll's charge.
 */
export function createGestureRail(opts: RailOptions) {
  let charge = 0
  let towards: Step | null = null
  let pinching = false
  let firedAt = Number.NEGATIVE_INFINITY

  return {
    feed(sample: WheelSample, now: number): Step | null {
      if (sample.deltaY === 0) return null
      // Zeroed rather than merely ignored: a tail allowed to bank would fire the
      // instant the cooldown lapsed, from a gesture the hand had already finished.
      if (now - firedAt < opts.cooldownMs) {
        charge = 0
        return null
      }

      // Scrolling away and spreading two fingers both mean inward, which is the
      // direction every map on this machine already agrees on.
      const direction: Step = sample.deltaY < 0 ? 'in' : 'out'
      if (direction !== towards || sample.ctrlKey !== pinching) charge = 0
      towards = direction
      pinching = sample.ctrlKey

      charge += Math.abs(sample.deltaY)
      const threshold = pinching ? opts.pinchThreshold : opts.wheelThreshold
      if (charge < threshold) return null

      charge = 0
      firedAt = now
      return direction
    },
  }
}
