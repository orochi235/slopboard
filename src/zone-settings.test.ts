import { describe, expect, it } from 'vitest'
import { backdropFor, tintsFor } from '@/zone-settings.ts'

describe('tintsFor', () => {
  it('leaves a zone that has chosen nothing on its project color', () => {
    expect(tintsFor({ weasel: '#102030' }, {})).toEqual({ weasel: '#102030' })
  })

  it('puts a zone that has chosen one over the project color', () => {
    expect(tintsFor({ weasel: '#102030' }, { weasel: { color: '#abcdef' } })).toEqual({
      weasel: '#abcdef',
    })
  })

  it('gives a color to a zone whose project has none', () => {
    expect(tintsFor({}, { weasel: { color: '#abcdef' } })).toEqual({ weasel: '#abcdef' })
  })

  it('leaves the project color alone for a zone that only set something else', () => {
    expect(tintsFor({ weasel: '#102030' }, { weasel: { backdrop: 'dots' } })).toEqual({
      weasel: '#102030',
    })
  })
})

describe('backdropFor', () => {
  it('falls back to the wall for a zone that has chosen nothing', () => {
    expect(backdropFor(undefined, 'hatch')).toBe('hatch')
    expect(backdropFor({}, 'hatch')).toBe('hatch')
  })

  it('takes the zone over the wall', () => {
    expect(backdropFor({ backdrop: 'dots' }, 'hatch')).toBe('dots')
  })

  it("holds a zone's `none` against a wall that rules everything", () => {
    expect(backdropFor({ backdrop: 'none' }, 'hatch')).toBe('none')
  })
})
