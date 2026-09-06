import { orbitOffset } from '@/camera/orbit.ts'

export type Vec = [number, number, number]

export const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const unit = (v: Vec): Vec => {
  const n = Math.hypot(...v)
  return n === 0 ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n]
}

/**
 * Where the camera's own right, up and forward point in world space at this
 * yaw and pitch. Both the axis gizmo and the step drag need it: one to say
 * which way an axis points on screen, the other to turn a drag in pixels back
 * into a move in the world.
 */
export function cameraBasis(yawDeg: number, pitchDeg: number): {
  right: Vec
  up: Vec
  forward: Vec
} {
  const eye = orbitOffset(yawDeg, pitchDeg, 1)
  const forward = unit([-eye.x, -eye.y, -eye.z])
  const right = unit(cross(forward, [0, 1, 0]))
  return { right, up: cross(right, forward), forward }
}
