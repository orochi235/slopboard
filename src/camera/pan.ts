/**
 * Sliding a wall that is wider than the window.
 *
 * Only reachable where the camera has stopped fitting the wall's width —
 * `camera.fitWidth` off, which is what lets a zone hold its size as zones are
 * added instead of every pile shrinking to keep the row in frame. The offset
 * is world units along x, away from the framing the camera would have picked.
 */

/** How far the view can slide each way before it runs off the row's own ends. */
export function panRange(boxWidth: number, halfWidth: number): number {
  return Math.max(0, boxWidth / 2 - halfWidth)
}

/** The offset, held inside the row. */
export function clampPan(pan: number, boxWidth: number, halfWidth: number): number {
  const range = panRange(boxWidth, halfWidth)
  return Math.min(Math.max(pan, -range), range)
}

/**
 * The smallest offset that brings `target` fully into view, or the offset
 * unchanged when it already is.
 *
 * Minimal on purpose: arrowing along a row should slide it by the one cell
 * that was off the edge, not recenter the wall under the reader every step.
 */
export function revealPan(
  pan: number,
  target: { x: number; w: number },
  box: { x: number; w: number },
  halfWidth: number,
): number {
  const center = box.x + box.w / 2 + pan
  const left = center - halfWidth
  const right = center + halfWidth
  let next = pan
  if (target.x < left) next = pan - (left - target.x)
  else if (target.x + target.w > right) next = pan + (target.x + target.w - right)
  return clampPan(next, box.w, halfWidth)
}
