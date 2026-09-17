import { describe, expect, it } from 'vitest'
import { offscreen, type Box } from './whitespace.ts'

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 })

describe('offscreen', () => {
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
})
