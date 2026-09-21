import { describe, expect, it } from 'vitest'
import type { WallItem } from '@shared/protocol.ts'
import { keptByKind, kindOf, kindTally, toggleKind, type KindKey } from './kind-filter.ts'

const item = (over: Partial<WallItem> = {}): WallItem =>
  ({ id: 'a', zone: 'z', name: 'a.png', url: '/a', path: '/a', bornAt: 0, w: 1, h: 1, ...over }) as WallItem

describe('kindOf', () => {
  it('calls a still picture an image and a multi-frame one an anim', () => {
    expect(kindOf(item())).toBe('image')
    expect(kindOf(item({ frames: 1 }))).toBe('image')
    expect(kindOf(item({ frames: 24 }))).toBe('anim')
  })

  it('takes the protocol kind where there is one', () => {
    expect(kindOf(item({ kind: 'page' }))).toBe('page')
    expect(kindOf(item({ kind: 'video' }))).toBe('video')
    expect(kindOf(item({ kind: 'mesh' }))).toBe('mesh')
  })
})

describe('keptByKind', () => {
  it('keeps everything while nothing is picked', () => {
    expect(keptByKind(item({ kind: 'mesh' }), new Set())).toBe(true)
  })

  it('keeps only the picked kinds once one is', () => {
    const picked = new Set<KindKey>(['mesh', 'video'])
    expect(keptByKind(item({ kind: 'mesh' }), picked)).toBe(true)
    expect(keptByKind(item(), picked)).toBe(false)
  })
})

describe('kindTally', () => {
  it('counts in KINDS order and leaves out the kinds the wall holds none of', () => {
    expect(kindTally([item({ kind: 'mesh' }), item(), item({ frames: 8 }), item({ kind: 'mesh' })])).toEqual([
      { key: 'image', label: 'image', count: 1 },
      { key: 'anim', label: 'anim', count: 1 },
      { key: 'mesh', label: 'mesh', count: 2 },
    ])
  })

  it('is empty for an empty wall', () => {
    expect(kindTally([])).toEqual([])
  })
})

describe('toggleKind', () => {
  it('adds a kind that is off and drops one that is on, never in place', () => {
    const none: ReadonlySet<KindKey> = new Set()
    const one = toggleKind(none, 'page')
    expect([...one]).toEqual(['page'])
    expect(none.size).toBe(0)
    expect([...toggleKind(one, 'page')]).toEqual([])
  })
})
