import { describe, expect, it } from 'vitest'
import { inZoneOrder, sortFlags, zoneOrder } from './sort.ts'
import type { Level } from '@shared/attention.ts'
import type { WallItem } from '@shared/protocol.ts'

const NOW = 1_000_000_000

const item = (
  id: string,
  zone: string,
  bornAt: number,
  flag?: { level: Level; holdMs?: number | null },
): WallItem => ({
  id,
  url: `/img/${id}`,
  origUrl: `/orig/${id}`,
  zone,
  name: id,
  bornAt,
  path: `/tmp/${id}.png`,
  w: 100,
  h: 100,
  ...(flag ? { attention: { level: flag.level, holdMs: flag.holdMs ?? null } } : {}),
})

describe('zoneOrder', () => {
  const items = [
    item('a', 'zeta', NOW - 10_000),
    item('b', 'alpha', NOW - 1000, { level: 'soon' }),
    item('c', 'mid', NOW - 5000, { level: 'problem' }),
  ]

  it('sorts by name under project, which is the order nothing can move', () => {
    expect(zoneOrder(items, 'project', NOW)).toEqual(['alpha', 'mid', 'zeta'])
  })

  it('puts the loudest zone first under severity', () => {
    expect(zoneOrder(items, 'severity', NOW)).toEqual(['mid', 'alpha', 'zeta'])
  })

  it('puts the zone with the newest artifact first under recency', () => {
    expect(zoneOrder(items, 'recency', NOW)).toEqual(['alpha', 'mid', 'zeta'])
  })

  it('ranks a zone by its loudest artifact, not its last', () => {
    const mixed = [
      item('x', 'one', NOW, { level: 'look' }),
      item('y', 'one', NOW - 9000, { level: 'problem' }),
      item('z', 'two', NOW, { level: 'urgent' }),
    ]
    expect(zoneOrder(mixed, 'severity', NOW)).toEqual(['one', 'two'])
  })

  it('drops a lapsed flag below a live one of any level', () => {
    const lapsed = [
      item('x', 'quiet', NOW - 60_000, { level: 'problem', holdMs: 1000 }),
      item('y', 'live', NOW - 60_000, { level: 'look' }),
    ]
    expect(zoneOrder(lapsed, 'severity', NOW)).toEqual(['live', 'quiet'])
  })

  it('breaks a tie on name, so the same wall reads the same twice', () => {
    const tied = [item('x', 'beta', NOW), item('y', 'alpha', NOW)]
    expect(zoneOrder(tied, 'recency', NOW)).toEqual(['alpha', 'beta'])
  })
})

describe('inZoneOrder', () => {
  it('groups items into the given zone order', () => {
    const model = [
      { id: 'a', zone: 'late' },
      { id: 'b', zone: 'early' },
      { id: 'c', zone: 'late' },
    ]
    expect(inZoneOrder(model, ['early', 'late']).map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })

  it('leaves the order within a zone alone, which is the pile', () => {
    const model = [
      { id: 'first', zone: 'one' },
      { id: 'second', zone: 'one' },
    ]
    expect(inZoneOrder(model, ['one']).map((m) => m.id)).toEqual(['first', 'second'])
  })
})

describe('sortFlags', () => {
  const flags = [
    item('quiet', 'a', NOW - 1000, { level: 'look' }),
    item('loud', 'z', NOW - 9000, { level: 'problem' }),
    item('newest', 'm', NOW, { level: 'soon' }),
  ]

  it('leads with the loudest under severity, whatever its age', () => {
    expect(sortFlags(flags, 'severity', NOW).map((i) => i.id)).toEqual(['loud', 'newest', 'quiet'])
  })

  it('leads with the newest under recency', () => {
    expect(sortFlags(flags, 'recency', NOW).map((i) => i.id)).toEqual(['newest', 'quiet', 'loud'])
  })

  it('groups by zone under project, newest first inside one', () => {
    expect(sortFlags(flags, 'project', NOW).map((i) => i.zone)).toEqual(['a', 'm', 'z'])
  })
})
