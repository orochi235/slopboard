/**
 * How tall a chip stands on a card, and how far inside the corner it sits.
 *
 * A chip annotates its subject, so it shrinks with a small card rather than
 * covering it — but a card's size is its area, not its narrowest side. A
 * panorama is as big a thumbnail as a square of the same area and reads its age
 * just as well, where measuring the short side would shrink the chip by the
 * whole aspect ratio. The geometric mean is the side itself for a square card,
 * so those are unchanged.
 */
export type ChipRoom = {
  /** The chip's full world height, before any card shrinks it. */
  full: number
  /** The card as drawn, hover swell included. */
  cardW: number
  cardH: number
  /** How much of the card's overall size a chip may take. */
  share: number
  /** The chip's own width over its height, which decides whether it is the
   *  card's width that binds. */
  aspect: number
}

/** How much of a card's width and height a chip may take. The width is the
 *  loose one: a chip is wide and short, so a card narrow enough to bind on it
 *  has little room for a plate at any size. */
const MAX_WIDTH = 0.85
const MAX_HEIGHT = 0.4

export function chipHeightOn({ full, cardW, cardH, share, aspect }: ChipRoom): number {
  return Math.min(
    full,
    Math.sqrt(cardW * cardH) * share,
    (cardW * MAX_WIDTH) / aspect,
    cardH * MAX_HEIGHT,
  )
}
