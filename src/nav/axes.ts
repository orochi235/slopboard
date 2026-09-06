import { cameraBasis, dot, type Vec } from '@/camera/basis.ts'

/** One world axis as the camera currently sees it. `x`/`y` are screen
 *  directions, -1..1, with y up; `depth` is negative toward the viewer. */
export type AxisScreen = { name: 'x' | 'y' | 'z'; x: number; y: number; depth: number }

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
  const { right, up, forward } = cameraBasis(yawDeg, pitchDeg)
  return AXES.map(({ name, v }) => ({
    name,
    x: dot(v, right),
    y: dot(v, up),
    depth: dot(v, forward),
  }))
}
