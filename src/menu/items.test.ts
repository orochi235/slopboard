import { describe, expect, it } from 'vitest'
import { menuFor, targetOf } from '@/menu/items.ts'
import type { WallItem } from '@shared/protocol.ts'

const item = (over: Partial<WallItem> = {}): WallItem => ({
  id: 'a',
  url: '/img/a',
  origUrl: '/orig/a',
  zone: 'slopboard',
  name: 'a',
  path: '/slop/inbox/slopboard/a.png',
  bornAt: 1000,
  w: 200,
  h: 100,
  ...over,
})

describe('targetOf', () => {
  it('reads the chain the pick already returns', () => {
    expect(targetOf(['slopboard', 'a'])).toEqual({ kind: 'card', zone: 'slopboard', id: 'a' })
    expect(targetOf(['slopboard'])).toEqual({ kind: 'zone', zone: 'slopboard' })
    expect(targetOf([])).toEqual({ kind: 'sky' })
  })
})

describe('menuFor', () => {
  const actions = (...args: Parameters<typeof menuFor>) => menuFor(...args).map((i) => i.action)

  it('offers to keep a card that is not kept, and to release one that is', () => {
    const target = targetOf(['slopboard', 'a'])
    expect(actions(target, { item: item(), canUndo: false })).toContain('keep')
    expect(actions(target, { item: item({ keptAt: 2000 }), canUndo: false })).toContain('release')
    expect(actions(target, { item: item({ keptAt: 2000 }), canUndo: false })).not.toContain('keep')
  })

  it('offers to dismiss only a card that is asking', () => {
    const target = targetOf(['slopboard', 'a'])
    expect(actions(target, { item: item(), canUndo: false })).not.toContain('dismiss')
    expect(
      actions(target, {
        item: item({ attention: { level: 'look', holdMs: null } }),
        canUndo: false,
      }),
    ).toContain('dismiss')
  })

  it('puts the one destructive action last and marks it', () => {
    const menu = menuFor(targetOf(['slopboard', 'a']), { item: item(), canUndo: false })
    expect(menu.at(-1)?.action).toBe('expire')
    expect(menu.filter((i) => i.grave).map((i) => i.action)).toEqual(['expire'])
  })

  it('opens nothing over empty sky with nothing to undo', () => {
    expect(menuFor(targetOf([]), { canUndo: false })).toEqual([])
    expect(actions(targetOf([]), { canUndo: true })).toEqual(['undo'])
  })

  it('says nothing about a card the wall has already forgotten', () => {
    expect(menuFor(targetOf(['slopboard', 'gone']), { canUndo: false })).toEqual([])
  })
})
