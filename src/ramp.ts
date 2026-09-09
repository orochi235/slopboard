/** A scalar easing toward a target, restartable in flight. */
export type Ramp = { from: number; to: number; startedAt: number }

const easeOut = (t: number) => 1 - (1 - t) ** 3

export const rampOf = (value: number): Ramp => ({ from: value, to: value, startedAt: 0 })

/** Closed-form in `now`, like `poseAt`: a dropped frame costs nothing and a
 *  re-render mid-ramp does not restart it. */
export function rampAt(ramp: Ramp, now: number, ms: number): number {
  if (ms <= 0) return ramp.to
  const t = Math.max(0, Math.min(1, (now - ramp.startedAt) / ms))
  return ramp.from + (ramp.to - ramp.from) * easeOut(t)
}

/** Aim at a new target, leaving from wherever the ramp has actually reached —
 *  so reversing mid-flight is continuous rather than a jump back to the end it
 *  was heading for. Aiming where it is already going is a no-op. */
export function rampTo(ramp: Ramp, to: number, now: number, ms: number): Ramp {
  return ramp.to === to ? ramp : { from: rampAt(ramp, now, ms), to, startedAt: now }
}
