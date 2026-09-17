import { describe, expect, it } from 'vitest'
import { prefsTabs, resolveTab, stepTab } from '@/prefs.tabs.ts'

describe('prefsTabs', () => {
  it('leads with the whole of params, then one nested tab per group in order', () => {
    const tabs = prefsTabs(['wall', 'camera'])
    expect(tabs.map((t) => [t.id, t.depth, t.group])).toEqual([
      ['params', 0, undefined],
      ['params.wall', 1, 'wall'],
      ['params.camera', 1, 'camera'],
    ])
  })
})

describe('resolveTab', () => {
  const tabs = prefsTabs(['wall', 'camera'])
  it('keeps a remembered tab the list still has', () => {
    expect(resolveTab(tabs, 'params.camera').group).toBe('camera')
  })
  it('falls back to the whole of params for a group that was folded away', () => {
    expect(resolveTab(tabs, 'params.gone').id).toBe('params')
    expect(resolveTab(tabs, null).id).toBe('params')
  })
})

describe('stepTab', () => {
  const tabs = prefsTabs(['wall', 'camera'])
  it('moves by rows and wraps at both ends', () => {
    expect(stepTab(tabs, 'params', 1).id).toBe('params.wall')
    expect(stepTab(tabs, 'params', -1).id).toBe('params.camera')
    expect(stepTab(tabs, 'params.camera', 1).id).toBe('params')
  })
})
