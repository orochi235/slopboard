import { describe, expect, it } from 'vitest'
import { loopPositions } from '@/backends/fatLines.ts'

describe('loopPositions', () => {
  it('emits four segments as endpoint pairs, not as a path', () => {
    const p = loopPositions(0, 0, 1, 1)
    expect(p).toHaveLength(4 * 2 * 3)
  })

  it('closes the rectangle, so the last segment returns to the first corner', () => {
    const p = loopPositions(2, 3, 5, 7)
    expect(p.slice(0, 3)).toEqual([2, 3, 0])
    expect(p.slice(-3)).toEqual([2, 3, 0])
  })

  it('carries a z, which the card outline needs and the zone outline does not', () => {
    expect(loopPositions(0, 0, 1, 1, -0.5).slice(0, 3)).toEqual([0, 0, -0.5])
  })
})
