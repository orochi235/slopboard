import type { Box } from './whitespace.ts'

/**
 * Where a pile's plates may stand as a group. `welded` is the one plate of a
 * pile whose only flag is on the front card, resting on that card with no line.
 */
export type Side = 'left' | 'right' | 'above' | 'below'
export const SIDES: readonly Side[] = ['right', 'left', 'above', 'below']

export type Placement = { side: Side | 'welded'; ring: number }

/** A card as the ladder sees it: its center and half extents in the pile's plane. */
export type Card = { x: number; y: number; hw: number; hh: number }
export type PlateSize = { w: number; h: number }

/**
 * Every plate of a pile at the same offset from its own card, so the group
 * inherits the pile's own step and reads as its projection. Where that step is
 * shorter than a plate, later plates slide along the pile's axis until they
 * clear the one before, so the order of the ladder is always the order of the
 * pile. Ring 1 touches the pile, at `gap`; each ring past it stands one plate
 * height further out, the same stride on every side.
 */
export function ladder(
  cards: readonly Card[],
  plates: readonly PlateSize[],
  side: Side,
  ring: number,
  gap: number,
): { dx: number; dy: number }[] {
  const flank = side === 'left' || side === 'right'
  const sign = side === 'right' || side === 'above' ? 1 : -1
  const stride = Math.max(0, ...plates.map((p) => p.h)) * (ring - 1)
  const out: { dx: number; dy: number }[] = []
  const first = cards[0]
  const last = cards[cards.length - 1]
  // Which way deeper ranks run along the ladder's axis. A pile with no step
  // on that axis climbs, or runs right, so a spread never buries a plate.
  const along = flank ? (last?.y ?? 0) - (first?.y ?? 0) : (last?.x ?? 0) - (first?.x ?? 0)
  const dir = along === 0 ? 1 : Math.sign(along)
  let prev: { at: number; half: number } | undefined
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const plate = plates[i]
    if (!card || !plate) continue
    let dx = flank ? sign * (card.hw + plate.w / 2 + gap + stride) : 0
    let dy = flank ? 0 : sign * (card.hh + plate.h / 2 + gap + stride)
    const half = flank ? plate.h / 2 : plate.w / 2
    let at = flank ? card.y + dy : card.x + dx
    if (prev) {
      const need = prev.half + half + gap
      if (Math.abs(at - prev.at) < need) {
        at = prev.at + dir * need
        if (flank) dy = at - card.y
        else dx = at - card.x
      }
    }
    prev = { at, half }
    out.push({ dx, dy })
  }
  return out
}

export type Candidate = Placement & { boxes: readonly Box[] }

/** One pile's plates, and every place the group could stand, in screen space. */
export type Group = {
  zone: string
  /** The plated cards, in pile order, matching each candidate's boxes. */
  cards: readonly Box[]
  candidates: readonly Candidate[]
  /** Where the group stands now, if it has been placed before. */
  held?: Placement
}

export type Weights = {
  /** Per plate wholly over a card; a partial cover pays its share, and cards
   *  stacked under it each charge, so a pile reads as busier than one card. */
  cover: number
  /** Per screen unit of leader line, summed over the group. */
  pull: number
  /** Flat, per plate that needs a line at all. */
  line: number
  /** Per plate wholly over another zone's cell; a partial cover pays its share. */
  foreign: number
  /** Per group standing on a side the others do not. */
  mismatch: number
  /** The share of its score a new layout must beat the held one by before the
   *  wall leaves it. A share rather than a sum so that zooming, which scales
   *  every score together, is never by itself a reason to move. */
  settle: number
}

/** Two plates covering each other leaves neither readable: fixed, and above
 *  anything a knob can reach. Scaled by how much of the smaller plate is covered. */
const OVERLAP = 1200

/** Per plate wholly off the screen; a partial pays its share. As heavy as
 *  two plates on top of each other: nobody can read either. */
const OFFSCREEN = 1200

const SCREEN: Box = { x0: 0, y0: 0, x1: 1, y1: 1 }

const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)

/** The share of the smaller box the two have in common. */
const covered = (a: Box, b: Box): number => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  if (w <= 0 || h <= 0) return 0
  const smaller = Math.min(area(a), area(b))
  return smaller > 0 ? (w * h) / smaller : 0
}

/** The share of `plate` that `under` covers. */
const coveredOf = (plate: Box, under: Box): number => {
  const w = Math.min(plate.x1, under.x1) - Math.max(plate.x0, under.x0)
  const h = Math.min(plate.y1, under.y1) - Math.max(plate.y0, under.y0)
  if (w <= 0 || h <= 0) return 0
  const own = area(plate)
  return own > 0 ? (w * h) / own : 0
}

/** Shortest distance between two boxes, zero when they touch or overlap. */
const gapBetween = (a: Box, b: Box): number =>
  Math.hypot(
    Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)),
    Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)),
  )

const same = (a: Placement, b: Placement) => a.side === b.side && a.ring === b.ring

/**
 * One number for the whole wall. Every plate pays for the cards it covers, for
 * hanging off screen, for its line and for standing on another zone's ground;
 * groups pay for covering each other and for disagreeing about which side of
 * their pile to stand on.
 */
export function scoreLayout(
  obstacles: readonly Box[],
  cells: readonly { zone: string; box: Box }[],
  groups: readonly Group[],
  picks: readonly number[],
  weights: Weights,
): number {
  let total = 0
  const votes = new Map<Side, number>()
  let voting = 0
  const placed: Box[][] = []
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    const candidate = group?.candidates[picks[g] ?? -1]
    if (!group || !candidate) {
      placed.push([])
      continue
    }
    placed.push([...candidate.boxes])
    if (candidate.side !== 'welded') {
      voting++
      votes.set(candidate.side, (votes.get(candidate.side) ?? 0) + 1)
    }
    for (let i = 0; i < candidate.boxes.length; i++) {
      const box = candidate.boxes[i]
      const card = group.cards[i]
      if (!box) continue
      total += (1 - coveredOf(box, SCREEN)) * OFFSCREEN
      for (const under of obstacles) total += coveredOf(box, under) * weights.cover
      if (candidate.side !== 'welded') {
        total += weights.line
        if (card) total += gapBetween(box, card) * weights.pull
      }
      for (const cell of cells) {
        if (cell.zone === group.zone) continue
        total += coveredOf(box, cell.box) * weights.foreign
      }
    }
  }
  for (let a = 0; a < placed.length; a++) {
    for (let b = a + 1; b < placed.length; b++) {
      for (const pa of placed[a] ?? []) for (const pb of placed[b] ?? []) total += covered(pa, pb) * OVERLAP
    }
  }
  let agreed = 0
  for (const n of votes.values()) agreed = Math.max(agreed, n)
  total += (voting - agreed) * weights.mismatch
  return total
}

/**
 * Where every group stands next. Coordinate descent from a handful of seeds:
 * the layout the wall holds, and one per side with every pile on it, so a
 * shared side is always on the table. The wall keeps what it has unless the
 * best of them is better by `settle`; a pile that has just gained its first
 * plate is placed against the held layout rather than shaking it.
 */
export function solve(
  obstacles: readonly Box[],
  cells: readonly { zone: string; box: Box }[],
  groups: readonly Group[],
  weights: Weights,
): { picks: Placement[]; score: number } {
  const total = (picks: number[]) => scoreLayout(obstacles, cells, groups, picks, weights)
  const indexOf = (group: Group, want: Placement) =>
    group.candidates.findIndex((c) => same(c, want))
  const alone = (g: number): number => {
    // Cheapest on its own, for a group with nowhere to start from.
    const lone = groups.map(() => -1)
    let best = 0
    let bestScore = Infinity
    for (let c = 0; c < (groups[g]?.candidates.length ?? 0); c++) {
      lone[g] = c
      const s = total(lone)
      if (s < bestScore) {
        bestScore = s
        best = c
      }
    }
    return best
  }

  const descend = (picks: number[]): number => {
    let best = total(picks)
    for (let sweep = 0; sweep < 8; sweep++) {
      let improved = false
      for (let g = 0; g < groups.length; g++) {
        let was = picks[g] ?? 0
        for (let c = 0; c < (groups[g]?.candidates.length ?? 0); c++) {
          if (c === was) continue
          picks[g] = c
          const s = total(picks)
          if (s < best - 1e-9) {
            best = s
            was = c
            improved = true
          } else picks[g] = was
        }
      }
      if (!improved) break
    }
    return best
  }

  const heldIdx = groups.map((group) => (group.held ? indexOf(group, group.held) : -1))
  const complete = groups.length > 0 && heldIdx.every((i) => i >= 0)
  const heldSeed = heldIdx.map((i, g) => (i >= 0 ? i : alone(g)))

  let baseline: { picks: number[]; score: number }
  if (complete) baseline = { picks: [...heldIdx], score: total(heldIdx) }
  else {
    const picks = [...heldSeed]
    baseline = { picks, score: descend(picks) }
  }

  let best = complete ? (() => {
    const picks = [...heldSeed]
    return { picks, score: descend(picks) }
  })() : baseline
  for (const side of SIDES) {
    const picks = groups.map((group, g) => {
      const i = indexOf(group, { side, ring: 1 })
      return i >= 0 ? i : heldSeed[g] ?? 0
    })
    const s = descend(picks)
    if (s < best.score - 1e-9) best = { picks, score: s }
  }

  const chosen = best.score < baseline.score * (1 - weights.settle) - 1e-9 ? best : baseline
  return {
    picks: chosen.picks.map((c, g) => {
      const candidate = groups[g]?.candidates[c]
      return candidate ? { side: candidate.side, ring: candidate.ring } : { side: 'welded', ring: 1 }
    }),
    score: chosen.score,
  }
}
