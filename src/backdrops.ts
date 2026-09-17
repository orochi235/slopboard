/**
 * What a zone's cell is ruled with, behind its cards. `none` draws nothing and
 * `solid` a flat tint; the rest are line art, ruled in world space so they
 * read at one density across the wall. The shader in `backends/hatch.ts`
 * draws them; the minimap draws the ones SVG can.
 */
export const BACKDROPS = [
  'none',
  'solid',
  'hatch',
  'crosshatch',
  'diamonds',
  'bricks',
  'dots',
  'checks',
] as const

export type Backdrop = (typeof BACKDROPS)[number]

/** The shader's case for each pattern. `none` is not drawn at all. */
export const PATTERN_INDEX: Record<Backdrop, number> = {
  none: -1,
  solid: 0,
  hatch: 1,
  crosshatch: 2,
  diamonds: 3,
  bricks: 4,
  dots: 5,
  checks: 6,
}
