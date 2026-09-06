import { cameraBasis } from '@/camera/basis.ts'

export type Step = { x: number; y: number; z: number }

/**
 * A card dragged across the screen, read back as the pile's per-rank step.
 *
 * The drag is in pixels on a wall that may be turned, so it goes out through
 * the camera's own right and up before it means anything in the world: at a
 * quarter turn, dragging right moves the pile deeper, not sideways.
 */
export function stepFromDrag({
  base,
  dxPx,
  dyPx,
  rank,
  worldPerPx,
  yawDeg,
  pitchDeg,
}: {
  base: Step
  dxPx: number
  dyPx: number
  /** How many ranks back the dragged card sits. Zero spreads over one: the
   *  front card does not move with the step, so a drag on it opens the pile
   *  out behind it rather than doing nothing. */
  rank: number
  worldPerPx: number
  yawDeg: number
  pitchDeg: number
}): Step {
  const over = Math.max(1, rank)
  const { right, up } = cameraBasis(yawDeg, pitchDeg)
  // Screen y grows down and the world's grows up.
  const ax = dxPx * worldPerPx
  const ay = -dyPx * worldPerPx
  const move = [right[0] * ax + up[0] * ay, right[1] * ax + up[1] * ay, right[2] * ax + up[2] * ay]
  return {
    x: base.x + (move[0] as number) / over,
    y: base.y + (move[1] as number) / over,
    z: base.z + (move[2] as number) / over,
  }
}
