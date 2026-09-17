/** A rectangle in screen space, 0..1 across and down. */
export type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * Nothing of this box is on screen. Anything scored as an obstacle has to be
 * dropped through here first: a card projected wholly off one side still has a
 * box, and would read as busy ground along the edge it went out by.
 */
export const offscreen = (box: Box): boolean =>
  box.x1 <= 0 || box.x0 >= 1 || box.y1 <= 0 || box.y0 >= 1
