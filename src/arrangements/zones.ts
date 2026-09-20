import { gridStrategy } from 'windease'
import type { Rect, Size as WeSize } from 'windease'
import { createSlots } from './slots.ts'
import type { StackParams } from '@/params.ts'

/**
 * How many columns to lay `count` cells out in, for the biggest square cell the
 * container will hold.
 *
 * windease auto-balances on the count alone — `ceil(sqrt(n))` columns for
 * `wide`, `floor(sqrt(n))` for `tall` — which keeps the *grid* square and says
 * nothing about the container it is squaring inside. Ten zones in a container
 * half again as tall as it is wide get four columns and three short rows, and
 * every pile is smaller than it needed to be. Orientation is the only lever the
 * kit offers and it is a fixed bias, not a fit, so the count is worked out here
 * and handed over.
 *
 * A card is square, so the cell to maximize is the square one: the score is the
 * shorter side of a cell, not its area.
 */
export function colsFor(count: number, container: WeSize, gap: number): number {
  let best = 1
  let bestSide = -1
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const w = (container.w - gap * (cols - 1)) / cols
    const h = (container.h - gap * (rows - 1)) / rows
    const side = Math.min(w, h)
    // Strictly greater, so the fewest columns that reach the best cell win —
    // a tie between 3x4 and 4x3 in a square container takes the narrower grid
    // rather than letting the loop's last pass decide it.
    if (side > bestSide) {
      bestSide = side
      best = cols
    }
  }
  return best
}

/**
 * Every cell the grid lays out for `count` items, in the order the strategy
 * placed them. Pure, so the wall can ask for the cells of a grid it is not
 * laying out — which is how it frames the room a spare cell reserves without
 * the strategy having to publish anything.
 */
export function gridCells(
  count: number,
  container: WeSize,
  cfg: StackParams['zoneGrid'],
): Rect[] {
  if (count <= 0) return []
  // Only where neither axis is pinned: a set `cols` or `rows` is an answer
  // already given, and fitting over the top of it would ignore it.
  const fitted =
    cfg.cols === undefined && cfg.rows === undefined
      ? colsFor(count, container, cfg.gap)
      : undefined
  const out = gridStrategy.layout({
    items: Array.from({ length: count }, (_, i) => ({ id: String(i) })),
    container,
    state: undefined,
    options: {
      gap: cfg.gap,
      orientation: cfg.orientation,
      ...(cfg.cols === undefined ? (fitted === undefined ? {} : { cols: fitted }) : { cols: cfg.cols }),
      ...(cfg.rows === undefined ? {} : { rows: cfg.rows }),
    },
  })
  return Array.from({ length: count }, (_, i) => out.placements.get(String(i))).filter(
    (r): r is Rect => r !== undefined,
  )
}

/** Where a pile's front card stands in its cell — the box the wall frames,
 *  since a pile's deep ranks are allowed to run off behind it. */
export function frontSlotOf(cell: Rect, params: StackParams): Rect {
  return {
    x: cell.x + params.origin.x * (cell.w - params.side),
    y: cell.y + params.origin.y * (cell.h - params.side),
    z: 0,
    w: params.side,
    h: params.side,
  }
}

/**
 * One cell per zone, tiled by windease.
 *
 * Held: cells are addressed by slot index rather than by sorted zone name, so
 * a zone that arrives when an agent first writes to a new repo does not move
 * every pile already on the wall. Given: cells are filled in the order handed
 * in, which is what a sort key over the zones needs and costs exactly that
 * guarantee — the wall reshuffles whenever the order changes.
 */
export function createZoneGrid() {
  const slots = createSlots()

  return (
    zones: string[],
    container: WeSize,
    cfg: StackParams['zoneGrid'],
    order: 'held' | 'given' = 'held',
  ): Map<string, Rect> => {
    if (zones.length === 0) return new Map()

    let ordered = zones
    if (order === 'held') {
      const held = slots([...zones].sort())
      ordered = [...held.entries()].sort((a, b) => a[1] - b[1]).map(([zone]) => zone)
    }

    // The grid is laid out for `minCells` even when fewer zones exist, so two
    // zones take two of four cells rather than half the container each. The
    // cells past the last zone go unclaimed: they reserve room, and room
    // draws nothing.
    const cells = gridCells(Math.max(ordered.length, cfg.minCells), container, cfg)

    const placed = new Map<string, Rect>()
    ordered.forEach((zone, i) => {
      const cell = cells[i]
      if (cell) placed.set(zone, cell)
    })

    if (!cfg.reverseX && !cfg.reverseY) return placed

    // Mirrored within the container, which reverses an axis without touching
    // slot assignment: re-sorting the slots instead would hand every zone a
    // different cell and shuffle the whole wall.
    const mirrored = new Map<string, Rect>()
    for (const [zone, box] of placed) {
      mirrored.set(zone, {
        ...box,
        x: cfg.reverseX ? container.w - (box.x + box.w) : box.x,
        y: cfg.reverseY ? container.h - (box.y + box.h) : box.y,
      })
    }
    return mirrored
  }
}
