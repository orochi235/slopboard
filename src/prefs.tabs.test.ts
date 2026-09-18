import { describe, expect, it } from 'vitest'
import { prefsTabs, resolveTab, stepTab } from '@/prefs.tabs.ts'

const two = [
  { id: 'piles', label: 'piles' },
  { id: 'zones', label: 'zones & sky' },
]

describe('prefsTabs', () => {
  it('leads with general, then the whole of params and one nested tab per area', () => {
    const tabs = prefsTabs(two)
    expect(tabs.map((t) => [t.id, t.label, t.depth, t.category])).toEqual([
      ['general', 'general', 0, 'general'],
      ['params', 'params', 0, undefined],
      ['params.piles', 'piles', 1, 'piles'],
      ['params.zones', 'zones & sky', 1, 'zones'],
    ])
  })

  it('shows general alone rather than everything, unlike params', () => {
    const [general, all] = prefsTabs(two)
    expect(general?.category).toBe('general')
    expect(all?.category).toBeUndefined()
  })
})

describe('resolveTab', () => {
  const tabs = prefsTabs(two)
  it('keeps a remembered tab the list still has', () => {
    expect(resolveTab(tabs, 'params.zones').category).toBe('zones')
  })
  it('falls back to the first tab for one that is gone', () => {
    expect(resolveTab(tabs, 'params.gone').id).toBe('general')
    expect(resolveTab(tabs, null).id).toBe('general')
  })
  it('lands on general for a browser that remembered the retired wall tab', () => {
    expect(resolveTab(tabs, 'wall').id).toBe('general')
  })
})

describe('stepTab', () => {
  const tabs = prefsTabs(two)
  it('moves by rows and wraps at both ends', () => {
    expect(stepTab(tabs, 'general', 1).id).toBe('params')
    expect(stepTab(tabs, 'general', -1).id).toBe('params.zones')
    expect(stepTab(tabs, 'params.zones', 1).id).toBe('general')
    expect(stepTab(tabs, 'params', -1).id).toBe('general')
  })
})
