import { describe, expect, it } from 'vitest'
import type { Rect } from 'windease'
import { neighborOf } from '@/nav/neighbor.ts'

const cells = new Map<string, Rect>([
  ['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }],
  ['b', { x: 1, y: 0, z: 0, w: 1, h: 1 }],
  ['c', { x: 2, y: 0, z: 0, w: 1, h: 1 }],
  ['d', { x: 0, y: 1, z: 0, w: 1, h: 1 }],
  ['e', { x: 1, y: 1, z: 0, w: 1, h: 1 }],
  ['f', { x: 2, y: 1, z: 0, w: 1, h: 1 }],
])

/**
 * A zone's cell is the union of its pile's drawn cards, so a deep pile is a
 * different size from a shallow one and the rows do not line up to the pixel.
 * Centres and sizes measured off a running wall of six zones, 3x2.
 */
const wobbled = new Map<string, Rect>(
  (
    [
      ['alpha', 0.127, 0.134, 0.357, 0.341],
      ['bravo', 0.861, 0.134, 0.357, 0.341],
      ['charlie', 1.608, 0.144, 0.331, 0.323],
      ['delta', 0.14, 0.856, 0.331, 0.323],
      ['echo', 0.861, 0.847, 0.357, 0.341],
      ['foxtrot', 1.608, 0.856, 0.331, 0.323],
    ] as const
  ).map(([id, cx, cy, w, h]) => [id, { x: cx - w / 2, y: cy - h / 2, z: 0, w, h }]),
)

describe('neighborOf', () => {
  it('walks along a row', () => {
    expect(neighborOf(cells, 'a', 'right')).toBe('b')
    expect(neighborOf(cells, 'b', 'left')).toBe('a')
  })

  it('walks down a column', () => {
    expect(neighborOf(cells, 'b', 'down')).toBe('e')
    expect(neighborOf(cells, 'e', 'up')).toBe('b')
  })

  it('stops at an edge rather than wrapping', () => {
    expect(neighborOf(cells, 'c', 'right')).toBeNull()
    expect(neighborOf(cells, 'a', 'up')).toBeNull()
  })

  it('prefers the cell straight ahead over a nearer one off to the side', () => {
    expect(neighborOf(cells, 'a', 'down')).toBe('d')
  })

  it('stays on the axis it was sent along when the rows do not line up', () => {
    // `alpha` sits above `delta` and 0.013 to its left. Counted as a step left,
    // that 0.013 outscores having nowhere to go, and the arrow leaves the row.
    expect(neighborOf(wobbled, 'delta', 'left')).toBeNull()
    expect(neighborOf(wobbled, 'charlie', 'up')).toBeNull()
    expect(neighborOf(wobbled, 'echo', 'down')).toBeNull()
  })

  it('comes back to the cell it started from, on cells that do not line up', () => {
    const back = { left: 'right', right: 'left', up: 'down', down: 'up' } as const
    for (const id of wobbled.keys()) {
      for (const go of ['left', 'right', 'up', 'down'] as const) {
        const there = neighborOf(wobbled, id, go)
        if (there === null) continue
        expect(neighborOf(wobbled, there, back[go])).toBe(id)
      }
    }
  })

  it('answers null for a zone that is no longer on the wall', () => {
    expect(neighborOf(cells, 'gone', 'right')).toBeNull()
  })

  it('answers null when it is the only zone', () => {
    const one = new Map<string, Rect>([['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }]])
    expect(neighborOf(one, 'a', 'left')).toBeNull()
  })
})
