import { gridStrategy } from 'windease'
import type { Rect, Size as WeSize } from 'windease'
import { createSlots } from './slots.ts'
import type { StackParams } from '@/params.ts'

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

    const out = gridStrategy.layout({
      items: ordered.map((zone) => ({ id: zone })),
      container,
      state: undefined,
      options: {
        gap: cfg.gap,
        orientation: cfg.orientation,
        ...(cfg.cols === undefined ? {} : { cols: cfg.cols }),
        ...(cfg.rows === undefined ? {} : { rows: cfg.rows }),
      },
    })

    if (!cfg.reverseX && !cfg.reverseY) return out.placements

    // Mirrored within the container, which reverses an axis without touching
    // slot assignment: re-sorting the slots instead would hand every zone a
    // different cell and shuffle the whole wall.
    const mirrored = new Map<string, Rect>()
    for (const [zone, box] of out.placements) {
      mirrored.set(zone, {
        ...box,
        x: cfg.reverseX ? container.w - (box.x + box.w) : box.x,
        y: cfg.reverseY ? container.h - (box.y + box.h) : box.y,
      })
    }
    return mirrored
  }
}
