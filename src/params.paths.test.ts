import { describe, expect, it } from 'vitest'
import { getAt, numberPathsOf, setAt } from '@/params.paths.ts'

const sample = { a: 1, b: { c: 2, d: 'text' }, e: [3, 4], f: true }

describe('numberPathsOf', () => {
  it('finds every number, however deep', () => {
    expect(numberPathsOf(sample)).toEqual(['a', 'b.c', 'e.0', 'e.1'])
  })

  it('skips strings and booleans, which no number input can edit', () => {
    expect(numberPathsOf(sample)).not.toContain('b.d')
    expect(numberPathsOf(sample)).not.toContain('f')
  })
})

describe('getAt / setAt', () => {
  it('reads a nested value', () => {
    expect(getAt(sample, 'b.c')).toBe(2)
    expect(getAt(sample, 'e.1')).toBe(4)
  })

  it('writes without mutating the original', () => {
    const next = setAt(sample, 'b.c', 99)
    expect(getAt(next, 'b.c')).toBe(99)
    expect(sample.b.c).toBe(2)
  })

  it('keeps an array an array rather than turning it into an object', () => {
    const next = setAt(sample, 'e.0', 9)
    expect(Array.isArray(next.e)).toBe(true)
    expect(next.e).toEqual([9, 4])
  })
})
