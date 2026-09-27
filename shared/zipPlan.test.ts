import { describe, expect, it } from 'vitest'
import type { Take, WallItem } from '@shared/protocol.ts'
import { zipName, zipPlanForRun, zipPlanForZone } from '@shared/zipPlan.ts'

const item = (over: Partial<WallItem> = {}): WallItem => ({
  id: 'a',
  url: '/img/a',
  origUrl: '/orig/a',
  zone: 'slopboard',
  name: 'plot',
  path: '/slop/inbox/slopboard/plot.png',
  bornAt: 1000,
  w: 200,
  h: 100,
  ...over,
})

const take = (over: Partial<Take> = {}): Take => ({
  id: 't1',
  url: '/img/t1',
  origUrl: '/orig/t1',
  name: 'take',
  path: '/slop/inbox/slopboard/take.png',
  at: 1000,
  w: 10,
  h: 10,
  ...over,
})

describe('zipPlanForZone', () => {
  it('takes only that zone, oldest first', () => {
    const plan = zipPlanForZone(
      [
        item({ id: 'b', name: 'late', bornAt: 3000 }),
        item({ id: 'c', zone: 'elsewhere', name: 'other' }),
        item({ id: 'a', name: 'early', bornAt: 1000 }),
      ],
      'slopboard',
    )
    expect(plan).toEqual([
      { id: 'a', name: 'early.png' },
      { id: 'b', name: 'late.png' },
    ])
  })

  it('keeps the source extension, which the name has had taken off it', () => {
    const plan = zipPlanForZone(
      [item({ path: '/slop/inbox/slopboard/plot.slop-2h.webp' })],
      'slopboard',
    )
    expect(plan).toEqual([{ id: 'a', name: 'plot.webp' }])
  })

  it('separates two artifacts that carry one name', () => {
    const plan = zipPlanForZone([item({ id: 'a' }), item({ id: 'b', bornAt: 2000 })], 'slopboard')
    expect(plan.map((e) => e.name)).toEqual(['plot.png', 'plot-2.png'])
  })

  it('gives a run a folder of its takes', () => {
    const run = item({
      id: 'r',
      name: 'sweep',
      kind: 'run',
      takes: [take({ id: 't1', name: 'one' }), take({ id: 't2', name: 'two' })],
    })
    expect(zipPlanForZone([run], 'slopboard')).toEqual([
      { id: 't1', name: 'sweep/one.png' },
      { id: 't2', name: 'sweep/two.png' },
    ])
  })

  it('will not let a name climb out of the archive', () => {
    const plan = zipPlanForZone([item({ name: '../../etc/passwd' })], 'slopboard')
    expect(plan).toEqual([{ id: 'a', name: '-..-etc-passwd.png' }])
  })
})

describe('zipPlanForRun', () => {
  it('is flat — the archive is already named for the run', () => {
    const run = item({
      id: 'r',
      name: 'sweep',
      kind: 'run',
      takes: [take({ id: 't1', name: 'one' }), take({ id: 't2', name: 'one' })],
    })
    expect(zipPlanForRun(run)).toEqual([
      { id: 't1', name: 'one.png' },
      { id: 't2', name: 'one-2.png' },
    ])
  })

  it('falls back to the card itself for anything that is not a run', () => {
    expect(zipPlanForRun(item())).toEqual([{ id: 'a', name: 'plot.png' }])
  })
})

describe('zipName', () => {
  it('stamps the archive so a second one sits beside the first', () => {
    expect(zipName('slop board', new Date(2026, 8, 27, 14, 5))).toBe(
      'slop-slop-board-20260927-1405.zip',
    )
  })
})
