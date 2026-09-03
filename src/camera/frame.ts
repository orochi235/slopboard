import type { Rect } from 'windease'
import type { Projection } from '@/params.ts'

/**
 * What the camera is looking at and how big a slice of the world it shows.
 * Where it physically sits follows from this plus the view angle, so a pose
 * survives an orbit and both projections describe framing the same way.
 */
export type Pose = {
  /** The framed box's centre, in rect space — y grows downward. */
  x: number
  y: number
  /** How far the camera sits from that point along its view axis. */
  distance: number
  /** Half the world height the camera shows. Sets the orthographic frustum;
   *  under perspective it is what `distance` was derived from. */
  halfHeight: number
}

export type FrameView = {
  projection: Projection
  fovDeg: number
  standoff: number
  aspect: number
  margin: number
}

/**
 * The pose that fits `box` in frame. Height sets the framed extent, unless the
 * box is wider than the viewport covers at that height — then width binds.
 *
 * Distance is what carries the framing under perspective and is inert under
 * orthographic, where the frustum does, so an orthographic camera parks at a
 * fixed standoff and only ever changes how much it shows.
 */
export function framePose(box: Pick<Rect, 'x' | 'y' | 'w' | 'h'>, view: FrameView): Pose {
  const halfHeight = Math.max(box.h / 2, box.w / view.aspect / 2) * view.margin
  const halfFov = (view.fovDeg * Math.PI) / 360
  return {
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
    distance: view.projection === 'orthographic' ? view.standoff : halfHeight / Math.tan(halfFov),
    halfHeight,
  }
}
