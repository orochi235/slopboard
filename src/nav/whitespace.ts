/** A rectangle in screen space, 0..1 across and down. */
export type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * How busy each part of the screen is. Coarse on purpose: this decides where a
 * badge goes, and a grid fine enough to find a gap between two cards would
 * find gaps nobody would call whitespace.
 */
export type Grid = { cols: number; rows: number; cells: Float32Array }

export const makeGrid = (cols: number, rows: number): Grid => ({
  cols,
  rows,
  cells: new Float32Array(cols * rows),
})

const span = (lo: number, hi: number, n: number) => {
  const a = Math.max(0, Math.min(n - 1, Math.floor(lo * n)))
  const b = Math.max(0, Math.min(n - 1, Math.ceil(hi * n) - 1))
  return [a, Math.max(a, b)] as const
}

/** Everything drawn is marked once, so overlapping cards read as busier. */
export function mark(grid: Grid, box: Box, weight = 1): void {
  const [cx0, cx1] = span(box.x0, box.x1, grid.cols)
  const [cy0, cy1] = span(box.y0, box.y1, grid.rows)
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      grid.cells[y * grid.cols + x] = (grid.cells[y * grid.cols + x] ?? 0) + weight
    }
  }
}

/** How much a badge would cover if it were placed here. Off-screen counts as
 *  the busiest thing there is: a plate nobody can read is worse than one over
 *  a picture. */
const OFFSCREEN = 40

export function score(grid: Grid, box: Box): number {
  let total = 0
  const outside =
    Math.max(0, -box.x0) +
    Math.max(0, box.x1 - 1) +
    Math.max(0, -box.y0) +
    Math.max(0, box.y1 - 1)
  total += outside * OFFSCREEN

  const [cx0, cx1] = span(box.x0, box.x1, grid.cols)
  const [cy0, cy1] = span(box.y0, box.y1, grid.rows)
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) total += grid.cells[y * grid.cols + x] ?? 0
  }
  return total
}

/**
 * The emptiest place to put a plate. `cost` is what the caller pays for
 * choosing it at all — distance from the artifact, mostly — so a slightly
 * busier spot close by beats a perfectly empty one across the wall.
 */
export function choose(grid: Grid, candidates: readonly { box: Box; cost: number }[]): number {
  let best = -1
  let bestScore = Infinity
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    if (!candidate) continue
    const total = score(grid, candidate.box) + candidate.cost
    if (total < bestScore) {
      bestScore = total
      best = i
    }
  }
  return best
}
