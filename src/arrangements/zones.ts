import { gridStrategy } from 'windease'
import type { Rect, Size as WeSize } from 'windease'
import { createSlots } from './slots.ts'
import type { StackParams } from '@/params.ts'

/**
 * The box the zone grid is laid out in.
 *
 * Normally the viewport: the cells divide it, so a zone's cell shrinks as zones
 * arrive. With `cellW` set the box grows with the zone count instead, every
 * cell holds that width, and the row runs off the sides — which only works
 * where the camera has stopped fitting the wall's width.
 */
export function containerFor(
  zoneCount: number,
  aspect: number,
  cfg: StackParams['zoneGrid'],
): WeSize {
  if (cfg.cellW === undefined) return { w: aspect, h: 1 }
  return { w: Math.max(zoneCount, cfg.minCells) * cfg.cellW, h: 1 }
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
  const out = gridStrategy.layout({
    items: Array.from({ length: count }, (_, i) => ({ id: String(i) })),
    container,
    state: undefined,
    options: {
      gap: cfg.gap,
      orientation: cfg.orientation,
      ...(cfg.cols === undefined ? {} : { cols: cfg.cols }),
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
