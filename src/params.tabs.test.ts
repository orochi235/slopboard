import { describe, expect, it } from 'vitest'
import { controlsOf } from '@/params.controls.ts'
import { defaultParams } from '@/params.ts'
import { CATEGORIES, categoriesFor, categoryOf, OTHER } from '@/params.tabs.ts'

describe('categoryOf', () => {
  it('places a leaf by its group', () => {
    expect(categoryOf('step.x')).toBe('piles')
    expect(categoryOf('side')).toBe('piles')
    expect(categoryOf('attention.seekMs')).toBe('flags')
    expect(categoryOf('nav.quietMs')).toBe('camera')
  })

  it('lets a longer prefix split a group', () => {
    expect(categoryOf('lod.tiers.0.maxRank')).toBe('piles')
    expect(categoryOf('lod.revealHoldMs')).toBe('cards')
  })

  it('dissolves colors and typefaces into the tab of what they color', () => {
    expect(categoryOf('colors.attentionLook')).toBe('flags')
    expect(categoryOf('colors.skyGlow')).toBe('zones')
    expect(categoryOf('colors.accent')).toBe('chrome')
    expect(categoryOf('typeface.badge')).toBe('flags')
    expect(categoryOf('typeface.chrome')).toBe('chrome')
  })

  it('places every default leaf somewhere named, so nothing lands in other', () => {
    const strays = controlsOf(defaultParams)
      .map((c) => c.path)
      .filter((p) => categoryOf(p) === OTHER.id)
    expect(strays).toEqual([])
  })
})

describe('categoriesFor', () => {
  it('lists the six tabs in order for the defaults, with no other', () => {
    const tabs = categoriesFor(controlsOf(defaultParams).map((c) => c.path))
    expect(tabs).toEqual(CATEGORIES)
  })

  it('adds other last only when a leaf needs it', () => {
    expect(categoriesFor(['step.x', 'mystery.knob']).map((c) => c.id)).toEqual(['piles', 'other'])
  })
})
