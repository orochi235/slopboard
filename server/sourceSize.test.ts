import { describe, expect, it } from 'vitest'
import { orientedSize } from './sourceSize.ts'

describe('orientedSize', () => {
  it('reports the stored axes when there is no turn in the orientation', () => {
    expect(orientedSize({ width: 1590, height: 650, orientation: 1 })).toEqual({ w: 1590, h: 650 })
  })

  it('treats a missing orientation as untouched', () => {
    expect(orientedSize({ width: 1590, height: 650 })).toEqual({ w: 1590, h: 650 })
  })

  it('swaps the axes for the four orientations that carry a quarter turn', () => {
    for (const orientation of [5, 6, 7, 8]) {
      expect(orientedSize({ width: 4032, height: 3024, orientation })).toEqual({
        w: 3024,
        h: 4032,
      })
    }
  })

  it('leaves the axes alone for the four that do not', () => {
    for (const orientation of [1, 2, 3, 4]) {
      expect(orientedSize({ width: 4032, height: 3024, orientation })).toEqual({
        w: 4032,
        h: 3024,
      })
    }
  })

  it('has no answer for a file sharp could not measure', () => {
    expect(orientedSize({})).toBeNull()
    expect(orientedSize({ width: 0, height: 0 })).toBeNull()
    expect(orientedSize({ width: 100 })).toBeNull()
  })
})
