import { describe, expect, it } from 'vitest'
import { formatBytes, metaOf, statusOf } from '@/lightbox-meta.ts'
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
    expect(metaOf(item(), 240_000)).toEqual(['slopboard', '4m', 'png', '1024×576'])
  })

  it('says the repo only when it is not already the zone', () => {
    expect(metaOf(item({ repo: 'slopboard', sha: 'abc1234' }), 0)).toContain('abc1234')
    expect(metaOf(item({ repo: 'slopboard', sha: 'abc1234' }), 0)).not.toContain(
      'slopboard@abc1234',
    )
    expect(metaOf(item({ repo: 'weasel', sha: 'abc1234' }), 0)).toContain('weasel@abc1234')
  })

  it('says nothing about provenance for a file dropped in by hand', () => {
    expect(metaOf(item(), 0)).toEqual(['slopboard', '0s', 'png', '1024×576'])
  })

  it('names the format the original is in, not the thumbnail the card drew', () => {
    expect(metaOf(item({ path: '/slop/inbox/z/a.ttl30m.gif' }), 0)).toContain('gif')
    expect(metaOf(item({ path: '/slop/inbox/z/A.JPEG' }), 0)).toContain('jpeg')
  })

  it('calls a page a page, since its card is only a screenshot of one', () => {
    expect(metaOf(item({ kind: 'page', path: '/slop/inbox/z/a.html' }), 0)).toContain('page')
    expect(metaOf(item({ kind: 'page', path: '/slop/inbox/z/a.html' }), 0)).not.toContain('html')
  })

  it('counts the frames of an animation, which no still card can show', () => {
    expect(metaOf(item({ path: '/slop/inbox/z/a.gif', frames: 88 }), 0)).toContain('88 frames')
    expect(metaOf(item(), 0).some((p) => p.endsWith('frames'))).toBe(false)
  })

  it('gives a video its runtime, which the poster cannot show', () => {
    const video = { kind: 'video' as const, path: '/slop/inbox/z/a.mp4', duration: 243_000 }
    expect(metaOf(item(video), 0)).toContain('4:03')
    // Its container, not the word "video": that is what `/orig` hands over.
    expect(metaOf(item(video), 0)).toContain('mp4')
  })

  it('leaves the runtime out of a container that declared none', () => {
    const parts = metaOf(item({ kind: 'video', path: '/slop/inbox/z/a.webm' }), 0)
    expect(parts.some((p) => p.includes(':'))).toBe(false)
  })

  it('gives a mesh its file size, and drops the poster size it would lie with', () => {
    const mesh = { kind: 'mesh' as const, path: '/slop/inbox/z/head.glb', bytes: 4_404_019 }
    const parts = metaOf(item({ ...mesh, w: 1024, h: 1024 }), 0)
    expect(parts).toContain('glb')
    expect(parts).toContain('4.2 MB')
    expect(parts).not.toContain('1024×1024')
  })

  it('says nothing about a format for a file expiry has already renamed', () => {
    expect(metaOf(item({ path: '/slop/trash/abc123-slopboard' }), 0)).toEqual([
      'slopboard',
      '0s',
      '1024×576',
    ])
  })
})

describe('statusOf', () => {
  it('says nothing about an artifact that is in no particular state', () => {
    expect(statusOf(item())).toEqual([])
  })

  it('marks a rescued item, since nothing else about it says so', () => {
    expect(statusOf(item({ keptAt: 5 }))).toEqual(['kept'])
  })

  it('carries the flag and the level an asking card wears on the wall', () => {
    expect(statusOf(item({ note: 'broken', attention: { level: 'urgent', holdMs: null } }))).toEqual(
      ['broken', 'urgent'],
    )
  })

  it('says whether a question is still open, and how it closed if it is not', () => {
    expect(statusOf(item({ question: 'ship it?' }))).toEqual(['asked'])
    expect(
      statusOf(item({ question: 'ship it?', reply: { status: 'answered', text: 'yes', at: 1 } })),
    ).toEqual(['answered'])
  })
})

describe('formatBytes', () => {
  it('says a size the way a reader says it', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(4_404_019)).toBe('4.2 MB')
    expect(formatBytes(1_073_741_824)).toBe('1.0 GB')
  })

  it('drops the decimal once it stops meaning anything', () => {
    expect(formatBytes(83_100)).toBe('81 KB')
    expect(formatBytes(9_000)).toBe('8.8 KB')
  })
})
