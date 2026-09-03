import type { Rect } from 'windease'

/** Where the camera sits and what it looks at. Looking straight down -Z, so a
 *  pose is three numbers rather than a full transform. */
export type Pose = { x: number; y: number; z: number }

/**
 * The distance that fits `box` in frame. Height sets it, unless the box is
 * wider than the viewport covers at that distance — then width binds and the
 * camera pulls back.
 */
export function framePose(
  box: Pick<Rect, 'x' | 'y' | 'w' | 'h'>,
  view: { fovDeg: number; aspect: number; margin: number },
): Pose {
  const halfFov = (view.fovDeg * Math.PI) / 360
  const forHeight = box.h / 2 / Math.tan(halfFov)
  const forWidth = box.w / view.aspect / 2 / Math.tan(halfFov)
  return {
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
    z: Math.max(forHeight, forWidth) * view.margin,
  }
}
