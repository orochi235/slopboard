import { describe, expect, it } from 'vitest'
import { arrangements, arrangementsFor } from '@/arrangements/index.ts'

describe('the arrangement registry', () => {
  it('tags every arrangement with its dimensionality', () => {
    for (const a of arrangements) expect([2, 3]).toContain(a.dims)
  })

  it('filters to one backend, and grid stays the 2D control', () => {
    const flat = arrangementsFor(2)
    expect(flat.length).toBeGreaterThan(0)
    expect(flat.every((a) => a.dims === 2)).toBe(true)
    expect(flat[0]?.name).toBe('grid')
  })

  it('narrows on dims', () => {
    for (const a of arrangements) {
      if (a.dims === 2) expect(typeof a.arrange).toBe('function')
      else expect(typeof a.strategy.layout).toBe('function')
    }
  })
})
