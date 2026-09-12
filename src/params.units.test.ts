import { describe, expect, it } from 'vitest'
import { splitUnit } from '@/params.units.ts'

describe('splitUnit', () => {
  it('takes the unit off the name the panel prints', () => {
    expect(splitUnit('shoveMs')).toEqual({ label: 'shove', unit: 'ms' })
    expect(splitUnit('revealHoldMs')).toEqual({ label: 'revealHold', unit: 'ms' })
    expect(splitUnit('fovDeg')).toEqual({ label: 'fov', unit: '°' })
    expect(splitUnit('budgetBytes')).toEqual({ label: 'budget', unit: 'B' })
  })

  it('leaves a name that carries no unit alone', () => {
    expect(splitUnit('shrink')).toEqual({ label: 'shrink', unit: null })
    expect(splitUnit('labelSize')).toEqual({ label: 'labelSize', unit: null })
  })

  it('keeps a name that is only the suffix, since that is the name', () => {
    expect(splitUnit('Ms')).toEqual({ label: 'Ms', unit: null })
  })
})
