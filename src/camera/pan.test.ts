import { describe, expect, it } from 'vitest'
import { clampPan, panRange, revealPan } from '@/camera/pan.ts'

describe('panRange', () => {
  it('is nothing while the row fits the window', () => {
    expect(panRange(4, 3)).toBe(0)
  })

  it('is the overhang each way once it does not', () => {
    // A row 10 wide seen 3 either side of center: 2 hidden at each end.
    expect(panRange(10, 3)).toBe(2)
  })
})

describe('clampPan', () => {
  it('holds the view inside the row', () => {
    expect(clampPan(9, 10, 3)).toBe(2)
    expect(clampPan(-9, 10, 3)).toBe(-2)
    expect(clampPan(1, 10, 3)).toBe(1)
  })

  it('pins a row that fits at no offset at all', () => {
    expect(clampPan(5, 4, 3)).toBe(0)
  })
})

describe('revealPan', () => {
  const box = { x: 0, w: 12 }
  const half = 3

  it('leaves a cell that is already in view alone', () => {
    expect(revealPan(0, { x: 5, w: 2 }, box, half)).toBe(0)
  })

  it('slides only as far as the cell off the right edge', () => {
    // Centered on 6, showing 3..9. A cell at 9..11 needs 2 to clear.
    expect(revealPan(0, { x: 9, w: 2 }, box, half)).toBe(2)
  })

  it('slides the other way for a cell off the left edge', () => {
    expect(revealPan(0, { x: 1, w: 1 }, box, half)).toBe(-2)
  })

  it('never slides past the row to reveal something outside it', () => {
    expect(revealPan(0, { x: 40, w: 2 }, box, half)).toBe(panRange(12, 3))
  })
})
