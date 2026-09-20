import type { Backdrop } from '@shared/backdrops.ts'

/** The shader's case for each pattern. `none` is not drawn at all. */
export const PATTERN_INDEX: Record<Backdrop, number> = {
  none: -1,
  solid: 0,
  hatch: 1,
  crosshatch: 2,
  grid: 3,
  bricks: 4,
  dots: 5,
  checks: 6,
  argyle: 7,
  chevron: 8,
  waves: 9,
  scales: 10,
  hexagons: 11,
  triangles: 12,
  basketweave: 13,
}
