import type { Rect } from 'windease'
import type { Projection } from '@/params.ts'

/**
 * What the camera is looking at and how big a slice of the world it shows.
 * Where it physically sits follows from this plus the view angle, so a pose
 * survives an orbit and both projections describe framing the same way.
 */
export type Pose = {
  /** The framed box's center, in rect space — y grows downward. */
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
  /**
   * How much of the viewport's width is covered by chrome down the right-hand
   * side, as a fraction of 0..1. The sidebar is an overlay on the canvas rather
   * than a pane beside it, so without this the wall is framed to a width that
   * includes the part the sidebar is sitting on and the rightmost zones are
   * behind it at every zoom level.
   */
  insetRight?: number
  /**
   * How much of the viewport's height is covered by chrome across the top, as
   * a fraction of 0..1. The filter band is an overlay on the canvas rather
   * than a strip above it, so without this the wall is framed to a height that
   * includes the part the band is sitting on, and the top row of zones is
   * behind it at every zoom level.
   */
  insetTop?: number
  /**
   * How much world width to show, instead of whatever it takes to fit the box.
   * A wall set this way holds its scale as zones arrive — the row gets longer
   * rather than finer — and what runs off the sides is reached by panning.
   */
  showWidth?: number
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
  // Capped rather than trusted: chrome wider than the viewport would divide the
  // usable aspect by zero and park the camera at infinity.
  const insetRight = Math.min(Math.max(view.insetRight ?? 0, 0), 0.9)
  const insetTop = Math.min(Math.max(view.insetTop ?? 0, 0), 0.9)
  const usableAspect = view.aspect * (1 - insetRight)
  const halfHeight =
    view.showWidth === undefined
      ? Math.max(box.h / (1 - insetTop) / 2, box.w / usableAspect / 2) * view.margin
      : view.showWidth / usableAspect / 2
  const halfFov = (view.fovDeg * Math.PI) / 360
  // The uncovered part of the canvas is left of its center, so the camera moves
  // right by half the covered width to put the box in the middle of it.
  const shift = halfHeight * view.aspect * insetRight
  // The same, downward. Rect space grows y downward and the camera negates it,
  // so moving the camera *up* — a smaller y — is what drops the box clear of
  // the band.
  const shiftDown = halfHeight * insetTop
  return {
    x: box.x + box.w / 2 + shift,
    y: box.y + box.h / 2 - shiftDown,
    distance: view.projection === 'orthographic' ? view.standoff : halfHeight / Math.tan(halfFov),
    halfHeight,
  }
}

/** The world rectangle a pose shows on the wall plane: rect-space y flipped,
 *  the way the camera looks at it. */
export function frameExtent(pose: Pose, aspect: number): { x0: number; x1: number; y0: number; y1: number } {
  const halfWidth = pose.halfHeight * aspect
  return {
    x0: pose.x - halfWidth,
    x1: pose.x + halfWidth,
    y0: -pose.y - pose.halfHeight,
    y1: -pose.y + pose.halfHeight,
  }
}
