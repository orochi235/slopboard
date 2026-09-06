import { describe, expect, it } from 'vitest'
import { arrangements } from '@/arrangements/index.ts'

describe('the arrangement registry', () => {
  it('offers something to cycle through', () => {
    expect(arrangements.length).toBeGreaterThan(0)
  })

  it('gives every arrangement a name and a strategy the wall can run', () => {
    for (const a of arrangements) {
      expect(a.name).toBeTruthy()
      expect(typeof a.strategy.layout).toBe('function')
    }
  })
})
