import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/params.ts'
import { applyColors } from '@/theme.ts'

describe('applyColors', () => {
  it('writes one custom property per colour, kebab-cased for CSS', () => {
    const set: Record<string, string> = {}
    const el = { style: { setProperty: (k: string, v: string) => { set[k] = v } } } as HTMLElement
    applyColors(defaultParams.colors, el)
    expect(set['--accent']).toBe('#38bdf8')
    expect(set['--card-edge']).toBe('#22d3ee')
    expect(set['--zone-focus']).toBe('#38bdf8')
    expect(Object.keys(set)).toHaveLength(Object.keys(defaultParams.colors).length)
  })
})
