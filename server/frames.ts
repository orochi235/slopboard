/**
 * How many frames a picture plays, or null for a still.
 *
 * Pages, not frames: a multi-page TIFF reports `pages` too, and nothing about
 * it moves. Only a file that also carries per-frame delays is an animation.
 */
export type FrameMeta = { pages?: number; delay?: number[] }

export function framesOf(meta: FrameMeta): number | null {
  const { pages, delay } = meta
  if (!pages || pages < 2) return null
  if (!delay || delay.length < 2) return null
  return pages
}
