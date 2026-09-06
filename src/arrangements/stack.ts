import type { LayoutItem, LayoutResult, Rect } from 'windease'
import { createRanks, ramp } from './slots.ts'
import { createZoneGrid } from './zones.ts'
import { defaultParams, type StackParams } from '@/params.ts'
import type { Arrangement3D, SlopChannels } from './types.ts'

type StackItem = LayoutItem & { zone: string; age01: number; emphasis?: number }

/** Stable per-id noise in [-1, 1]. Cheap, and identical across cache drops. */
function hashUnit(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * The two presence curves, swappable from code. Deliberately not parameters:
 * `StackParams` round-trips through localStorage and the clipboard as JSON, and
 * a function does not survive that. Nothing in the repo passes them.
 */
export type Curves = {
  /** How much of a card age has taken, 0 at arrival to 1 at expiry. */
  fade: (age01: number, params: StackParams) => number
  /** The presence depth allows a card at this fractional rank, 0..1. */
  distance: (rank: number, params: StackParams) => number
}

const defaultCurves: Curves = {
  fade: (age01, p) => ramp(age01, p.fade.from, p.fade.to),
  distance: (rank, p) =>
    p.distance.enabled
      ? 1 - (1 - p.distance.floor) * ramp(rank, p.distance.from, p.distance.to)
      : 1,
}

const lodFor = (rank: number, tiers: StackParams['lod']['tiers']) =>
  tiers.find((tier) => rank <= tier.maxRank)?.edge ?? 0

/**
 * One diagonal pile per zone, tiled to a grid. Depth is rank, so an arrival
 * shoves its pile back one step and spacing stays even at any arrival rate.
 * Opacity is rank and age together — a card dies in place rather than at the
 * far end, and being buried dims it without ever claiming it is dying.
 */
export function createStack(
  params: StackParams = defaultParams,
  curves: Partial<Curves> = {},
): Arrangement3D {
  const { fade, distance } = { ...defaultCurves, ...curves }
  const ranksByZone = new Map<string, ReturnType<typeof createRanks>>()
  const zoneGrid = createZoneGrid()

  const ranksFor = (zone: string) => {
    let ranks = ranksByZone.get(zone)
    if (!ranks) {
      ranks = createRanks()
      ranksByZone.set(zone, ranks)
    }
    return ranks
  }

  return {
    name: 'stack',
    dims: 3,
    camera: {
      projection: params.camera.projection,
      fovDeg: params.camera.fovDeg,
      z:
        params.camera.projection === 'orthographic'
          ? params.camera.standoff
          : 0.5 / Math.tan((params.camera.fovDeg * Math.PI) / 360),
    },
    strategy: {
      name: 'slop-stack',
      layout({ items, container, options }): LayoutResult {
        const now = typeof options.now === 'number' ? options.now : Date.now()
        const all = items as StackItem[]

        const byZone = new Map<string, StackItem[]>()
        for (const it of all) {
          const bucket = byZone.get(it.zone)
          if (bucket) bucket.push(it)
          else byZone.set(it.zone, [it])
        }
        for (const bucket of byZone.values()) bucket.sort((a, b) => a.age01 - b.age01)

        const cells = zoneGrid([...byZone.keys()], container, params.zoneGrid)

        const placements = new Map<string, Rect>()
        const channels = new Map<string, Record<string, number>>()
        const unplaced: string[] = []

        for (const [zone, bucket] of byZone) {
          const cell = cells.get(zone)
          if (!cell) continue
          // The same relative point of the card meets that point of the cell,
          // so origin 0,0 hangs the pile corner-to-corner and 0.5,0.5 centres it.
          const originX = params.origin.x * (cell.w - params.side)
          const originY = params.origin.y * (cell.h - params.side)
          const held = ranksFor(zone)(
            bucket.map((i) => i.id),
            now,
          )

          for (const it of bucket) {
            const entry = held.get(it.id)
            if (!entry) continue
            if (entry.rank >= params.rankCap) {
              unplaced.push(it.id)
              continue
            }

            const settle = easeOut(Math.min(1, (now - entry.changedAt) / params.shoveMs))
            const depth = entry.prevRank + (entry.rank - entry.prevRank) * settle
            const noise = hashUnit(it.id)

            placements.set(it.id, {
              x: cell.x + originX + depth * params.step.x + noise * params.jitter.pos,
              y: cell.y + originY + depth * params.step.y + noise * params.jitter.pos,
              z: depth * params.step.z,
              w: params.side,
              h: params.side,
            })

            const byAge = 1 - fade(it.age01, params)
            const emphasis = it.emphasis ?? 0
            // An item asking to be looked at does not recede: emphasis floors
            // the depth falloff rather than being applied after it, so being
            // buried can dim it no further than the flag allows.
            const byDepth = Math.max(distance(depth, params), emphasis)

            channels.set(it.id, {
              z: depth * params.step.z,
              opacity:
                params.distance.combine === 'min' ? Math.min(byDepth, byAge) : byDepth * byAge,
              rotX: params.rot.x,
              rotY: params.rot.y,
              rotZ: noise * params.jitter.rot,
              lod: lodFor(entry.rank, params.lod.tiers),
              emphasis,
            } satisfies SlopChannels)
          }
        }

        return { placements, affordances: [], channels, ...(unplaced.length ? { unplaced } : {}) }
      },
    },
  }
}
