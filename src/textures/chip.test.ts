import { describe, expect, it } from 'vitest'
import { inkFor } from '@/textures/chip.ts'

describe('inkFor', () => {
  const DARK = '#ffffff'
  const LIGHT = '#000000'

  it('strikes a dark plate with the dark-plate ink', () => {
    expect(inkFor('#000000', DARK, LIGHT)).toBe(DARK)
    expect(inkFor('#334155', DARK, LIGHT)).toBe(DARK)
  })

  it('strikes a light plate with the light-plate ink', () => {
    expect(inkFor('#ffffff', DARK, LIGHT)).toBe(LIGHT)
    expect(inkFor('#ffe58f', DARK, LIGHT)).toBe(LIGHT)
  })

  // The same hex value in two channels: green carries most of the luminance
  // sum, so a mid green takes black and a mid blue takes white.
  it('weighs the channels rather than the hex', () => {
    expect(inkFor('#00c000', DARK, LIGHT)).toBe(LIGHT)
    expect(inkFor('#0000c0', DARK, LIGHT)).toBe(DARK)
  })

  it('reads a hex with no leading hash', () => {
    expect(inkFor('ffffff', DARK, LIGHT)).toBe(LIGHT)
  })
})
