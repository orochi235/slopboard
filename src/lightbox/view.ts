/**
 * Where a lightbox image sits and how big it is drawn, as pure arithmetic over
 * two sizes and a pointer.
 *
 * `scale` is CSS pixels per image pixel, and `x`/`y` offset the image's centre
 * from the viewport's centre in CSS pixels. Everything else is derived, so the
 * component holds one small object and no measurements of its own.
 */
export type Size = { w: number; h: number }
export type Point = { x: number; y: number }
export type View = { scale: number; x: number; y: number }

/** How far past the image's own pixels a zoom may go. Past 1 it is magnifying
 *  what is there rather than showing more, which is still what you want for
 *  reading a screenshot's small print. */
export const MAX_SCALE = 8

/** Fraction of the viewport a fitted image fills, leaving the frame's keyline
 *  and glow somewhere to land. */
export const FIT_MARGIN = 0.94

/** e-folds of scale per pixel of wheel travel. A notch is ~100px, so one notch
 *  is about 1.2x — small enough to land on a size, large enough to cross the
 *  range in a few flicks. */
const ZOOM_PER_PX = 0.0018

/**
 * The scale at which the whole image is visible. Never above 1: blowing a small
 * artifact up to fill the window is a decision, not a default, and `max-width`
 * has never done it here.
 */
export function fitScale(image: Size, port: Size): number {
  if (image.w <= 0 || image.h <= 0) return 1
  return Math.min(1, (port.w * FIT_MARGIN) / image.w, (port.h * FIT_MARGIN) / image.h)
}

/** The fitted, centred view — what opening an artifact shows. */
export function fitView(image: Size, port: Size): View {
  return { scale: fitScale(image, port), x: 0, y: 0 }
}

/**
 * Pan held inside the viewport. An axis whose image is smaller than the window
 * is centred and cannot be dragged; an axis larger than it may travel exactly
 * far enough to bring either edge to the window's edge and no further. Letting
 * a large image drift off into the scrim is the usual sloppy-viewer failure.
 */
export function clampPan(view: View, image: Size, port: Size): View {
  const slack = (drawn: number, within: number) => Math.max(0, (drawn - within) / 2)
  const rx = slack(image.w * view.scale, port.w)
  const ry = slack(image.h * view.scale, port.h)
  return {
    scale: view.scale,
    x: Math.min(rx, Math.max(-rx, view.x)),
    y: Math.min(ry, Math.max(-ry, view.y)),
  }
}

const clampScale = (scale: number, image: Size, port: Size) =>
  Math.min(MAX_SCALE, Math.max(fitScale(image, port), scale))

/**
 * Zoom to `scale`, keeping whatever image point is under `at` under it still.
 * Anchoring on the pointer rather than the centre is the whole difference
 * between aiming a zoom and chasing one.
 */
export function zoomTo(
  view: View,
  scale: number,
  at: Point,
  image: Size,
  port: Size,
): View {
  const next = clampScale(scale, image, port)
  // Where the anchored point sits relative to the image's centre, in image
  // pixels — the one quantity a zoom must not change.
  const ix = (at.x - port.w / 2 - view.x) / view.scale
  const iy = (at.y - port.h / 2 - view.y) / view.scale
  return clampPan(
    { scale: next, x: at.x - port.w / 2 - ix * next, y: at.y - port.h / 2 - iy * next },
    image,
    port,
  )
}

/** A wheel or pinch notch, as a multiplier on the current scale. */
export function zoomByWheel(
  view: View,
  deltaY: number,
  at: Point,
  image: Size,
  port: Size,
): View {
  return zoomTo(view, view.scale * Math.exp(-deltaY * ZOOM_PER_PX), at, image, port)
}

/** Dragged by a pointer delta, then held inside the viewport. */
export function panBy(view: View, dx: number, dy: number, image: Size, port: Size): View {
  return clampPan({ scale: view.scale, x: view.x + dx, y: view.y + dy }, image, port)
}

/** Whether the view has been zoomed off its fitted size. Pan, the grab cursor
 *  and the zoom readout all hang on this rather than on a mode flag. */
export function isZoomed(view: View, image: Size, port: Size): boolean {
  return view.scale > fitScale(image, port) + 1e-6
}

/**
 * What double-click alternates between: fitted, or the image's own pixels. From
 * fit it goes to 1:1, and from anywhere else back to fit — so a second
 * double-click always returns you, whatever the wheel did in between.
 */
export function toggleScale(view: View, image: Size, port: Size): number {
  return isZoomed(view, image, port) ? fitScale(image, port) : 1
}
