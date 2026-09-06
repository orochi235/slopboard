import { describe, expect, it } from 'vitest'
import { zoneCounts } from './zoneCounts.ts'
import type { WallItem } from '@shared/protocol.ts'

const at = (zone: string, id: string): WallItem => ({
  id,
  url: `/img/${id}`,
  origUrl: `/orig/${id}`,
  zone,
  name: id,
  path: `/slop/inbox/${zone}/${id}.png`,
  bornAt: 0,
  w: 1,
  h: 1,
})

describe('zoneCounts', () => {
  it('counts by zone, busiest first', () => {
    const counts = zoneCounts([at('a', '1'), at('b', '2'), at('b', '3')])
    expect(counts.map((c) => [c.zone, c.items])).toEqual([
      ['b', 2],
      ['a', 1],
    ])
  })

  it('breaks a tie by name, so the order does not flicker between polls', () => {
    expect(zoneCounts([at('z', '1'), at('a', '2')]).map((c) => c.zone)).toEqual(['a', 'z'])
  })

  it('carries the folder, so a caller never has to know where the inbox is', () => {
    expect(zoneCounts([at('a', '1')])[0]?.path).toMatch(/inbox\/a$/)
  })

  it('is empty for an empty wall', () => {
    expect(zoneCounts([])).toEqual([])
  })
})
