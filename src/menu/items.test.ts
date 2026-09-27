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

  it('offers to pin a card that is not pinned, and to unpin one that is', () => {
    const target = targetOf(['slopboard', 'a'])
    expect(actions(target, { item: item(), canUndo: false })).toContain('pin')
    expect(actions(target, { item: item({ keptAt: 2000 }), canUndo: false })).toContain('unpin')
    expect(actions(target, { item: item({ keptAt: 2000 }), canUndo: false })).not.toContain('pin')
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

  it('offers the artifact itself above its path', () => {
    const menu = actions(targetOf(['slopboard', 'a']), { item: item(), canUndo: false })
    expect(menu.indexOf('copyArtifact')).toBe(menu.indexOf('copyPath') - 1)
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

describe('menuFor on a zone', () => {
  const zone = targetOf(['slopboard'])

  const rowFor = (action: string, ctx: Parameters<typeof menuFor>[1]) =>
    menuFor(zone, ctx).find((i) => i.action === action)

  it('offers to take the zone, and says how many that is', () => {
    const row = rowFor('expireZone', { canUndo: false, zoneCount: 30 })
    expect(row?.label).toBe('Expire the zone (30)')
    expect(row?.grave).toBe(true)
  })

  it('asks again once it is armed, rather than opening a browser dialog', () => {
    const row = rowFor('expireZone', { canUndo: false, zoneCount: 30, armed: 'expireZone' })
    expect(row?.label).toBe('Really — expire 30')
  })

  it('offers to pin an unpinned zone and to unpin a pinned one', () => {
    expect(rowFor('pinZone', { canUndo: false, zoneCount: 3 })?.label).toBe(
      'Pin the zone to the top',
    )
    expect(rowFor('unpinZone', { canUndo: false, zoneCount: 3 })).toBeUndefined()

    const held = { canUndo: false, zoneCount: 3, zonePinned: true }
    expect(rowFor('unpinZone', held)?.label).toBe('Unpin the zone')
    expect(rowFor('pinZone', held)).toBeUndefined()
  })

  it('leads with the sheet, then the pin, then the row that takes the zone away', () => {
    const menu = menuFor(zone, { canUndo: false, zoneCount: 3 })
    expect(menu.map((i) => i.action)).toEqual([
      'configureZone',
      'pinZone',
      'zipZone',
      'expireZone',
    ])
  })

  it('marks nothing about the pin as destructive — it goes both ways', () => {
    const menu = menuFor(zone, { canUndo: false, zoneCount: 3, zonePinned: true })
    expect(menu.filter((i) => i.grave).map((i) => i.action)).toEqual(['expireZone'])
  })

  it('says what a zip of the zone would hold', () => {
    expect(rowFor('zipZone', { canUndo: false, zoneCount: 12 })?.label).toBe('Download zip (12)')
  })

  it('offers to zip a run, and nothing else on the wall', () => {
    const takes = ['t1', 't2', 't3'].map((id) => ({
      id,
      url: `/img/${id}`,
      origUrl: `/orig/${id}`,
      name: id,
      path: `/slop/inbox/z/${id}.png`,
      at: 1,
      w: 10,
      h: 10,
    }))
    const card = targetOf(['slopboard', 'a'])
    const run = menuFor(card, { item: item({ kind: 'run', takes }), canUndo: false })
    expect(run.find((i) => i.action === 'zipRun')?.label).toBe('Download zip of the run (3)')
    // A picture is one file, which Copy artifact and the lightbox's save both
    // already hand over.
    expect(menuFor(card, { item: item(), canUndo: false }).map((i) => i.action)).not.toContain(
      'zipRun',
    )
    expect(
      menuFor(card, { item: item({ kind: 'run', takes: takes.slice(0, 1) }), canUndo: false }).map(
        (i) => i.action,
      ),
    ).not.toContain('zipRun')
  })

  it('offers nothing on a zone that is already empty', () => {
    expect(menuFor(zone, { canUndo: false, zoneCount: 0 })).toEqual([])
    expect(menuFor(zone, { canUndo: false })).toEqual([])
  })

  it('offers each app the sender named, beside the OS default', () => {
    const menu = menuFor(targetOf(['slopboard', 'a']), {
      item: item({ apps: [{ name: 'LDView', path: '/p/3001.dat' }, { name: 'Finder', path: '/p' }] }),
      canUndo: false,
    })
    expect(menu.slice(0, 3).map((i) => i.label)).toEqual(['Open', 'Open in LDView', 'Open in Finder'])
    expect(menu.filter((i) => i.action === 'openInApp').map((i) => i.app)).toEqual([0, 1])
  })

  it('offers a run the apps of the take it is drawing', () => {
    const take = (id: string, apps?: { name: string; path: string }[]) => ({
      id,
      url: `/img/${id}`,
      origUrl: `/orig/${id}`,
      name: id,
      path: `/slop/inbox/z/${id}.png`,
      at: 1,
      w: 10,
      h: 10,
      question: 'reads?',
      ...(apps ? { apps } : {}),
    })
    const answered = { ...take('t1', [{ name: 'Wrong', path: '/a' }]), reply: { status: 'answered' as const, text: '', at: 2 } }
    const menu = menuFor(targetOf(['slopboard', 'a']), {
      item: item({ kind: 'run', takes: [answered, take('t2', [{ name: 'LDView', path: '/b' }])] }),
      canUndo: false,
    })
    expect(menu.filter((i) => i.action === 'openInApp').map((i) => i.label)).toEqual(['Open in LDView'])
  })

  it('leaves a card menu alone', () => {
    const card = menuFor(targetOf(['slopboard', 'a']), { item: item(), canUndo: false, zoneCount: 30 })
    expect(card.map((i) => i.action)).not.toContain('expireZone')
    expect(card.map((i) => i.action)).not.toContain('pinZone')
  })

  it('offers the pile from a card too, since a card is what the pointer lands on', () => {
    const card = menuFor(targetOf(['slopboard', 'a']), { item: item(), canUndo: false, zoneCount: 30 })
    expect(card.find((i) => i.action === 'zipZone')?.label).toBe('Download zip (30)')
    // Last before the row that takes the card away: the widest thing the menu
    // offers, and the only one that is not about the card itself.
    expect(card.map((i) => i.action).slice(-2)).toEqual(['zipZone', 'expire'])
  })
})
