/** Clearance from the pointer and from the window's edges. */
const PAD = 8

export type Box = { w: number; h: number }

/**
 * Where a menu opened at the pointer actually sits.
 *
 * It flips rather than slides when it would run off: a menu that slid up would
 * land under the cursor, and the first item would be whatever the pointer is
 * already on top of.
 */
export function placeMenu(
  at: { x: number; y: number },
  menu: Box,
  view: Box,
): { left: number; top: number } {
  const left = at.x + menu.w + PAD > view.w ? at.x - menu.w : at.x
  const top = at.y + menu.h + PAD > view.h ? at.y - menu.h : at.y
  return {
    left: Math.max(PAD, Math.min(left, view.w - menu.w - PAD)),
    top: Math.max(PAD, Math.min(top, view.h - menu.h - PAD)),
  }
}
