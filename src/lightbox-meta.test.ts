import { describe, expect, it } from 'vitest'
import { metaOf } from '@/lightbox-meta.ts'
import type { WallItem } from '@shared/protocol.ts'

const item = (over: Partial<WallItem> = {}): WallItem => ({
  id: 'a',
  url: '/img/a',
  origUrl: '/orig/a',
  zone: 'slopboard',
  name: 'a render',
  path: '/slop/inbox/slopboard/a.png',
  bornAt: 0,
  w: 1024,
  h: 576,
  ...over,
})

describe('metaOf', () => {
  it("leads with the zone and the age, in the wall's own register", () => {
    expect(metaOf(item(), 240_000)).toEqual(['slopboard', '4m', '1024×576'])
  })

  it('says the repo only when it is not already the zone', () => {
    expect(metaOf(item({ repo: 'slopboard', sha: 'abc1234' }), 0)).toContain('abc1234')
    expect(metaOf(item({ repo: 'slopboard', sha: 'abc1234' }), 0)).not.toContain(
      'slopboard@abc1234',
    )
    expect(metaOf(item({ repo: 'weasel', sha: 'abc1234' }), 0)).toContain('weasel@abc1234')
  })

  it('says nothing about provenance for a file dropped in by hand', () => {
    expect(metaOf(item(), 0)).toEqual(['slopboard', '0s', '1024×576'])
  })

  it('marks a rescued item, since nothing else about it says so', () => {
    expect(metaOf(item({ keptAt: 5 }), 0)).toContain('kept')
  })
})
