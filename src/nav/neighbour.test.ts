import { describe, expect, it } from 'vitest'
import type { Rect } from 'windease'
import { neighbourOf } from '@/nav/neighbour.ts'

const cells = new Map<string, Rect>([
  ['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }],
  ['b', { x: 1, y: 0, z: 0, w: 1, h: 1 }],
  ['c', { x: 2, y: 0, z: 0, w: 1, h: 1 }],
  ['d', { x: 0, y: 1, z: 0, w: 1, h: 1 }],
  ['e', { x: 1, y: 1, z: 0, w: 1, h: 1 }],
  ['f', { x: 2, y: 1, z: 0, w: 1, h: 1 }],
])

describe('neighbourOf', () => {
  it('walks along a row', () => {
    expect(neighbourOf(cells, 'a', 'right')).toBe('b')
    expect(neighbourOf(cells, 'b', 'left')).toBe('a')
  })

  it('walks down a column', () => {
    expect(neighbourOf(cells, 'b', 'down')).toBe('e')
    expect(neighbourOf(cells, 'e', 'up')).toBe('b')
  })

  it('stops at an edge rather than wrapping', () => {
    expect(neighbourOf(cells, 'c', 'right')).toBeNull()
    expect(neighbourOf(cells, 'a', 'up')).toBeNull()
  })

  it('prefers the cell straight ahead over a nearer one off to the side', () => {
    expect(neighbourOf(cells, 'a', 'down')).toBe('d')
  })

  it('answers null for a zone that is no longer on the wall', () => {
    expect(neighbourOf(cells, 'gone', 'right')).toBeNull()
  })

  it('answers null when it is the only zone', () => {
    const one = new Map<string, Rect>([['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }]])
    expect(neighbourOf(one, 'a', 'left')).toBeNull()
  })
})
