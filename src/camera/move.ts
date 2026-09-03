import type { Pose } from '@/camera/frame.ts'

export type Move = { from: Pose; to: Pose; startedAt: number; durationMs: number }

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Closed-form in `now`: a dropped frame costs nothing and a re-render mid-move
 *  does not restart it. */
export function poseAt(move: Move, now: number): Pose {
  if (move.durationMs <= 0) return move.to
  const t = Math.max(0, Math.min(1, (now - move.startedAt) / move.durationMs))
  const k = easeOut(t)
  return {
    x: move.from.x + (move.to.x - move.from.x) * k,
    y: move.from.y + (move.to.y - move.from.y) * k,
    z: move.from.z + (move.to.z - move.from.z) * k,
  }
}
