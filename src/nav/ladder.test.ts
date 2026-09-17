import { describe, expect, it } from 'vitest'
import { ladder, scoreLayout, solve, type Candidate, type Group, type Weights } from './ladder.ts'
import type { Box } from './whitespace.ts'

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 })

describe('ladder', () => {
  const plates = [
    { w: 0.3, h: 0.1 },
    { w: 0.3, h: 0.1 },
    { w: 0.3, h: 0.1 },
  ]

  it('puts every plate level with its own card on a flank, so the group steps as the pile does', () => {
    const cards = [
      { x: 0, y: 0, hw: 0.5, hh: 0.5 },
      { x: 0.1, y: 0.2, hw: 0.5, hh: 0.5 },
      { x: 0.2, y: 0.4, hw: 0.5, hh: 0.5 },
    ]
    const out = ladder(cards, plates, 'right', 1, 0.02)
    expect(out.every((o) => o.dy === 0)).toBe(true)
    expect(out.every((o) => o.dx === 0.5 + 0.15 + 0.02)).toBe(true)
  })

  it('spreads plates along the pile when its step is shorter than a plate, keeping the order', () => {
    const cards = [
      { x: 0, y: 0, hw: 0.5, hh: 0.5 },
      { x: 0.02, y: 0.03, hw: 0.5, hh: 0.5 },
      { x: 0.04, y: 0.06, hw: 0.5, hh: 0.5 },
    ]
    const out = ladder(cards, plates, 'left', 1, 0.02)
    const ys = out.map((o, i) => (cards[i]?.y ?? 0) + o.dy)
    expect(ys[0]).toBe(0)
    expect(ys[1]).toBeCloseTo(0.12)
    expect(ys[2]).toBeCloseTo(0.24)
    expect(out.every((o) => o.dx < 0)).toBe(true)
  })

  it('runs the spread the way the pile leans, and climbs when it does not lean at all', () => {
    const leaning = ladder(
      [
        { x: 0, y: 0, hw: 0.5, hh: 0.5 },
        { x: 0, y: -0.01, hw: 0.5, hh: 0.5 },
      ],
      plates,
      'right',
      1,
      0,
    )
    expect((leaning[1]?.dy ?? 0) + -0.01).toBeLessThan(0)
    const flat = ladder(
      [
        { x: 0, y: 0, hw: 0.5, hh: 0.5 },
        { x: 0, y: 0, hw: 0.5, hh: 0.5 },
      ],
      plates,
      'right',
      1,
      0,
    )
    expect(flat[1]?.dy).toBeGreaterThan(0)
  })

  it('lays a group above the pile sideways, each plate over its own card', () => {
    const cards = [
      { x: 0, y: 0, hw: 0.5, hh: 0.5 },
      { x: 0.5, y: 0.1, hw: 0.5, hh: 0.5 },
    ]
    const out = ladder(cards, plates, 'above', 1, 0.02)
    expect(out.every((o) => o.dx === 0)).toBe(true)
    expect(out.every((o) => o.dy === 0.5 + 0.05 + 0.02)).toBe(true)
  })

  it('steps one plate height further out per ring, rather than a whole plate width of nothing', () => {
    const cards = [{ x: 0, y: 0, hw: 0.5, hh: 0.5 }]
    const near = ladder(cards, plates, 'right', 1, 0.02)[0]!
    const far = ladder(cards, plates, 'right', 3, 0.02)[0]!
    expect(far.dx - near.dx).toBeCloseTo(0.2)
  })
})

const weights: Weights = { cover: 300, pull: 90, line: 140, foreign: 200, mismatch: 80, settle: 0.25 }

/** A plate box of the standard size, with its top-left at (x, y). */
const plate = (x: number, y: number): Box => box(x, y, x + 0.1, y + 0.04)

const candidate = (side: Candidate['side'], boxes: Box[], ring = 1): Candidate => ({ side, ring, boxes })

/** A pile with one plated card at (x, y), offered welded and both flanks. */
const lone = (zone: string, x: number, y: number): Group => ({
  zone,
  cards: [box(x, y, x + 0.2, y + 0.2)],
  candidates: [
    candidate('welded', [plate(x, y - 0.05)]),
    candidate('right', [plate(x + 0.22, y + 0.08)]),
    candidate('left', [plate(x - 0.12, y + 0.08)]),
  ],
})

/** Two plated cards in a pile at (x, y): the group stands on either flank. */
const pair = (zone: string, x: number, y: number): Group => ({
  zone,
  cards: [box(x, y, x + 0.2, y + 0.2), box(x + 0.02, y - 0.02, x + 0.22, y + 0.18)],
  candidates: [
    candidate('right', [plate(x + 0.22, y + 0.1), plate(x + 0.24, y + 0.04)]),
    candidate('left', [plate(x - 0.12, y + 0.1), plate(x - 0.1, y + 0.04)]),
  ],
})

describe('solve', () => {
  it('welds the lone plate of a front card rather than paying for a line', () => {
    const { picks } = solve([], [], [lone('a', 0.4, 0.4)], weights)
    expect(picks[0]?.side).toBe('welded')
  })

  it('stands every pile on the same side of an empty wall', () => {
    const groups = [pair('a', 0.2, 0.4), pair('b', 0.5, 0.4), pair('c', 0.8, 0.4)]
    const { picks } = solve([], [], groups, weights)
    const sides = new Set(picks.map((p) => p.side))
    expect(sides.size).toBe(1)
  })

  it('lets one pile leave the shared side when its own copy of that side is covered', () => {
    // A card to the right of pile b and one to the left of pile a: neither
    // side suits both, so the mismatch is the lesser cost.
    const cards = [box(0.85, 0.3, 1, 0.6), box(0, 0.3, 0.15, 0.6)]
    const groups = [pair('a', 0.15, 0.4), pair('b', 0.65, 0.4)]
    const { picks } = solve(cards, [], groups, weights)
    expect(picks[0]?.side).toBe('right')
    expect(picks[1]?.side).toBe('left')
  })

  it('moves the whole wall over when the shared side is worse for most of it', () => {
    const cards = [box(0.42, 0.3, 0.62, 0.6), box(0.72, 0.3, 0.92, 0.6)]
    const groups = [pair('a', 0.2, 0.4), pair('b', 0.5, 0.4)]
    const { picks } = solve(cards, [], groups, weights)
    expect(picks.every((p) => p.side === 'left')).toBe(true)
  })

  it('holds a settled layout against an improvement smaller than the settle margin', () => {
    const held = { side: 'right', ring: 1 } as const
    const groups = [{ ...pair('a', 0.4, 0.4), held }]
    // A card's corner just under the right flank: not worth leaving for.
    const corner = [box(0.62, 0.4, 0.64, 0.5)]
    expect(solve(corner, [], groups, weights).picks[0]?.side).toBe('right')
    // A card under the whole flank is.
    const card = [box(0.62, 0.4, 0.75, 0.5)]
    expect(solve(card, [], groups, weights).picks[0]?.side).toBe('left')
  })

  it('places a new pile against the held layout without moving the others', () => {
    // A sliver of card under every left flank, so the free answer is right —
    // except that a is held left, and one mismatch costs more than a sliver.
    const slivers = [box(0.39, 0.3, 0.4, 0.6), box(0.69, 0.3, 0.7, 0.6)]
    const groups = [{ ...pair('a', 0.5, 0.4), held: { side: 'left', ring: 1 } as const }, pair('b', 0.8, 0.4)]
    const { picks } = solve(slivers, [], groups, weights)
    expect(picks[0]?.side).toBe('left')
    expect(picks[1]?.side).toBe('left')
  })

  it('takes another zone’s empty cell over its own covered ground, but not over free space', () => {
    const cells = [{ zone: 'b', box: box(0.62, 0.2, 0.95, 0.7) }]
    const group = pair('a', 0.4, 0.4)
    // Right stands in b's cell; left is free. Left wins.
    expect(solve([], cells, [group], weights).picks[0]?.side).toBe('left')
    // Cover the left flank with a card, and b's empty cell becomes the lesser evil.
    expect(solve([box(0.25, 0.3, 0.4, 0.6)], cells, [group], weights).picks[0]?.side).toBe('right')
  })

  it('charges two groups for covering each other far more than for a line', () => {
    const a: Group = { zone: 'a', cards: [box(0.4, 0.4, 0.6, 0.6)], candidates: [candidate('right', [plate(0.62, 0.5)])] }
    const b: Group = { zone: 'b', cards: [box(0.7, 0.4, 0.9, 0.6)], candidates: [candidate('left', [plate(0.62, 0.5)])] }
    const apart = scoreLayout([], [], [a], [0], weights)
    const together = scoreLayout([], [], [a, b], [0, 0], weights)
    expect(together - apart).toBeGreaterThan(weights.line * 5)
  })

  it('charges a plate nothing for touching the card it belongs to', () => {
    const group = pair('a', 0.4, 0.4)
    const touching = scoreLayout(group.cards, [], [group], [0], weights)
    const clear = scoreLayout([], [], [group], [0], weights)
    expect(touching).toBe(clear)
  })

  it('charges a plate over the edge of the screen more than one over a picture', () => {
    const out: Group = { zone: 'a', cards: [box(0.8, 0.4, 1, 0.6)], candidates: [candidate('right', [plate(0.95, 0.5)])] }
    const over: Group = { zone: 'a', cards: [box(0.4, 0.4, 0.6, 0.6)], candidates: [candidate('above', [plate(0.45, 0.42)])] }
    expect(scoreLayout([], [], [out], [0], weights)).toBeGreaterThan(
      scoreLayout([box(0.4, 0.4, 0.6, 0.6)], [], [over], [0], weights),
    )
  })

  it('has nothing to say about an empty wall', () => {
    expect(solve([], [], [], weights).picks).toEqual([])
  })
})
