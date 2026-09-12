import { describe, expect, it } from 'vitest'
import { framesOf } from './frames.ts'

describe('framesOf', () => {
  it('counts the frames of an animation', () => {
    expect(framesOf({ pages: 88, delay: Array(88).fill(70) })).toBe(88)
  })

  it('has no answer for a still', () => {
    expect(framesOf({})).toBeNull()
    expect(framesOf({ pages: 1 })).toBeNull()
    expect(framesOf({ pages: 1, delay: [0] })).toBeNull()
  })

  it('leaves a multi-page scan alone, since nothing about it moves', () => {
    expect(framesOf({ pages: 12 })).toBeNull()
    expect(framesOf({ pages: 12, delay: [] })).toBeNull()
  })
})
