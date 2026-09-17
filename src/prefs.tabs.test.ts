import { describe, expect, it } from 'vitest'
import { prefsTabs, resolveTab, stepTab } from '@/prefs.tabs.ts'

const two = [
  { id: 'piles', label: 'piles' },
  { id: 'zones', label: 'zones & sky' },
]

describe('prefsTabs', () => {
  it('leads with the whole of params, then one nested tab per area in order', () => {
    const tabs = prefsTabs(two)
    expect(tabs.map((t) => [t.id, t.label, t.depth, t.category])).toEqual([
      ['params', 'params', 0, undefined],
      ['params.piles', 'piles', 1, 'piles'],
      ['params.zones', 'zones & sky', 1, 'zones'],
      ['wall', 'wall', 0, undefined],
    ])
  })
})

describe('resolveTab', () => {
  const tabs = prefsTabs(two)
  it('keeps a remembered tab the list still has', () => {
    expect(resolveTab(tabs, 'params.zones').category).toBe('zones')
  })
  it('falls back to the whole of params for a tab that is gone', () => {
    expect(resolveTab(tabs, 'params.gone').id).toBe('params')
    expect(resolveTab(tabs, null).id).toBe('params')
  })
})

describe('stepTab', () => {
  const tabs = prefsTabs(two)
  it('moves by rows and wraps at both ends', () => {
    expect(stepTab(tabs, 'params', 1).id).toBe('params.piles')
    expect(stepTab(tabs, 'params', -1).id).toBe('wall')
    expect(stepTab(tabs, 'params.zones', 1).id).toBe('wall')
    expect(stepTab(tabs, 'wall', 1).id).toBe('params')
  })
})
