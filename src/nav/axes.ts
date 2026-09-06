import { orbitOffset } from '@/camera/orbit.ts'

/** One world axis as the camera currently sees it. `x`/`y` are screen
 *  directions, -1..1, with y up; `depth` is negative toward the viewer. */
export type AxisScreen = { name: 'x' | 'y' | 'z'; x: number; y: number; depth: number }

type Vec = [number, number, number]

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const unit = (v: Vec): Vec => {
  const n = Math.hypot(...v)
  return n === 0 ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n]
}

const AXES: ReadonlyArray<{ name: AxisScreen['name']; v: Vec }> = [
  { name: 'x', v: [1, 0, 0] },
  { name: 'y', v: [0, 1, 0] },
  { name: 'z', v: [0, 0, 1] },
]

/**
 * The three world axes projected the way the camera at this yaw and pitch sees
 * them. Pure, and a function of the same two params the drag writes, so the
 * gizmo cannot disagree with the wall it is describing.
 */
export function axisScreens(yawDeg: number, pitchDeg: number): AxisScreen[] {
  const eye = orbitOffset(yawDeg, pitchDeg, 1)
  const forward = unit([-eye.x, -eye.y, -eye.z])
  const right = unit(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  return AXES.map(({ name, v }) => ({
    name,
    x: dot(v, right),
    y: dot(v, up),
    depth: dot(v, forward),
  }))
}
