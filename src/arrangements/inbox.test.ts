import { describe, expect, it } from 'vitest'
import type { Rect } from 'windease'
import { createInbox, gridLayout, mosaicLayout, riverLayout } from './inbox.ts'
import { defaultParams, type InboxMode } from '@/params.ts'

const cfg = { ...defaultParams.inbox, gap: 0.01, maxSide: 1, floor: 0.05 }
const box = { w: 1.6, h: 1 }
const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`)

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9

const inside = (r: Rect) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= box.w + 1e-9 && r.y + r.h <= box.h + 1e-9

function expectClean(rects: Map<string, Rect>) {
  const all = [...rects.values()]
  for (const r of all) expect(inside(r)).toBe(true)
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i]!, all[j]!)).toBe(false)
}

describe('inbox grid', () => {
  it('puts the newest first in reading order', () => {
    const { rects } = gridLayout(ids(6), box, cfg)
    const a0 = rects.get('a0')!
    const a1 = rects.get('a1')!
    expect(a1.x).toBeGreaterThan(a0.x)
    expect(a1.y).toBe(a0.y)
    expectClean(rects)
  })

  it('shrinks cards as the count grows, down to the floor', () => {
    const few = gridLayout(ids(4), box, cfg).rects.get('a0')!.w
    const many = gridLayout(ids(40), box, cfg).rects.get('a0')!.w
    expect(many).toBeLessThan(few)
    expect(many).toBeGreaterThanOrEqual(cfg.floor)
  })

  it('cuts the oldest once the floor is reached', () => {
    const { rects, unplaced } = gridLayout(ids(2000), box, cfg)
    expect(unplaced.length).toBeGreaterThan(0)
    expect(rects.has('a0')).toBe(true)
    expect(unplaced).toContain('a1999')
    expect(rects.size + unplaced.length).toBe(2000)
    expectClean(rects)
  })

  it('never lets a card grow past maxSide', () => {
    const { rects } = gridLayout(ids(1), box, { ...cfg, maxSide: 0.3 })
    expect(rects.get('a0')!.w).toBeCloseTo(0.3)
  })
})

describe('inbox mosaic', () => {
  it('gives the newest the biggest card', () => {
    const { rects } = mosaicLayout(ids(20), box, cfg)
    const big = rects.get('a0')!.w
    const mid = rects.get('a1')!.w
    const small = rects.get('a19')!.w
    expect(big).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(small)
    expectClean(rects)
  })

  it('places everything it can and cuts only the oldest', () => {
    const { rects, unplaced } = mosaicLayout(ids(3000), box, cfg)
    expect(unplaced.length).toBeGreaterThan(0)
    expect(rects.size + unplaced.length).toBe(3000)
    expect(unplaced[0]).toBe(`a${rects.size}`)
    expectClean(rects)
  })
})

describe('inbox river', () => {
  const lane = (id: string) => Number(id.slice(1))
  const aged = (ages: number[]) => ages.map((age01, i) => ({ id: `a${i}`, age01 }))

  it('sets distance from the left edge by age', () => {
    const { rects } = riverLayout(aged([0, 0.5, 1]), box, { ...cfg, lanes: 3 }, lane)
    expect(rects.get('a0')!.x).toBeCloseTo(0)
    expect(rects.get('a1')!.x).toBeGreaterThan(0)
    expect(rects.get('a2')!.x + rects.get('a2')!.w).toBeCloseTo(box.w)
    expectClean(rects)
  })

  it('pushes a card that would overlap the newer one in its lane, and cuts what runs off', () => {
    const { rects, unplaced } = riverLayout(aged(new Array(40).fill(0.9)), box, { ...cfg, lanes: 1 }, () => 0)
    expect(unplaced.length).toBeGreaterThan(0)
    expect(rects.size).toBe(1)
    expectClean(rects)
  })
})

describe('createInbox', () => {
  const run = (mode: InboxMode, n: number) => {
    const inbox = createInbox({ ...defaultParams, inbox: { ...defaultParams.inbox, mode } })
    return inbox.strategy.layout({
      items: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, age01: i / n, zone: `z${i % 3}` })),
      container: box,
      state: undefined,
      options: { now: 0 },
    })
  }

  it('is flat and places every artifact in every mode', () => {
    for (const mode of ['grid', 'mosaic', 'river'] as const) {
      const out = run(mode, 12)
      expect(out.placements.size + (out.unplaced?.length ?? 0)).toBe(12)
      expect(out.channels?.size).toBe(out.placements.size)
    }
    expect(createInbox().flat).toBe(true)
  })

  it('fades a card with age through the shared fade window', () => {
    const out = run('grid', 10)
    const channels = out.channels as Map<string, { opacity: number }>
    expect(channels.get('a0')!.opacity).toBe(1)
    expect(channels.get('a9')!.opacity).toBeLessThan(1)
  })
})
