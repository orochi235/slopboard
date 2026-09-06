import { describe, expect, it } from 'vitest'
import { choose, makeGrid, mark, offscreen, score, type Box } from './whitespace.ts'

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 })

describe('the occupancy grid', () => {
  it('scores nothing on an empty wall', () => {
    expect(score(makeGrid(16, 16), box(0.1, 0.1, 0.3, 0.3))).toBe(0)
  })

  it('scores what has been marked under it', () => {
    const grid = makeGrid(16, 16)
    mark(grid, box(0, 0, 0.5, 0.5))
    expect(score(grid, box(0.1, 0.1, 0.3, 0.3))).toBeGreaterThan(0)
    expect(score(grid, box(0.6, 0.6, 0.9, 0.9))).toBe(0)
  })

  it('piles marks up, so a busy region costs more than a quiet one', () => {
    const grid = makeGrid(16, 16)
    mark(grid, box(0, 0, 0.5, 0.5))
    mark(grid, box(0, 0, 0.5, 0.5))
    const busy = score(grid, box(0.1, 0.1, 0.2, 0.2))
    mark(grid, box(0.6, 0.6, 0.9, 0.9))
    expect(busy).toBeGreaterThan(score(grid, box(0.7, 0.7, 0.8, 0.8)))
  })

  it('charges for hanging off the screen, so a placement stays visible', () => {
    const grid = makeGrid(16, 16)
    expect(score(grid, box(-0.3, 0.4, -0.05, 0.5))).toBeGreaterThan(0)
    expect(score(grid, box(0.4, 0.4, 0.5, 0.5))).toBe(0)
  })
})

describe('choose', () => {
  it('takes the candidate over empty space', () => {
    const grid = makeGrid(16, 16)
    mark(grid, box(0, 0, 0.5, 1))
    const picked = choose(grid, [
      { box: box(0.1, 0.4, 0.3, 0.5), cost: 0 },
      { box: box(0.6, 0.4, 0.8, 0.5), cost: 0 },
    ])
    expect(picked).toBe(1)
  })

  it('breaks a tie toward the cheaper candidate, so a leader line stays short', () => {
    const grid = makeGrid(16, 16)
    const picked = choose(grid, [
      { box: box(0.6, 0.4, 0.8, 0.5), cost: 5 },
      { box: box(0.2, 0.7, 0.4, 0.8), cost: 1 },
    ])
    expect(picked).toBe(1)
  })

  it('still answers when every candidate is crowded', () => {
    const grid = makeGrid(16, 16)
    mark(grid, box(0, 0, 1, 1))
    const picked = choose(grid, [
      { box: box(0.1, 0.1, 0.2, 0.2), cost: 3 },
      { box: box(0.5, 0.5, 0.6, 0.6), cost: 1 },
    ])
    expect(picked).toBe(1)
  })

  it('has no answer with nothing to choose between', () => {
    expect(choose(makeGrid(4, 4), [])).toBe(-1)
  })
})

describe('offscreen', () => {
  const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 })

  it('rejects a box wholly off each side', () => {
    expect(offscreen(box(-3, 0.2, -2, 0.8))).toBe(true)
    expect(offscreen(box(2, 0.2, 3, 0.8))).toBe(true)
    expect(offscreen(box(0.2, -3, 0.8, -2))).toBe(true)
    expect(offscreen(box(0.2, 2, 0.8, 3))).toBe(true)
  })

  it('keeps a box that is only partly out, which still covers what it covers', () => {
    expect(offscreen(box(-0.5, 0.2, 0.4, 0.8))).toBe(false)
  })

  it('keeps a box on screen', () => {
    expect(offscreen(box(0.2, 0.2, 0.4, 0.4))).toBe(false)
  })

  it('does not let an offscreen card mark the edge it was clamped to', () => {
    const grid = makeGrid(8, 8)
    const far = box(-5, 0.4, -4, 0.6)
    if (!offscreen(far)) mark(grid, far)
    expect(Array.from(grid.cells).every((c) => c === 0)).toBe(true)
    // The same box marked without the guard is what the bug looked like.
    mark(grid, far)
    expect(Array.from(grid.cells).some((c) => c > 0)).toBe(true)
  })
})
