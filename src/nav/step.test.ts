import { describe, expect, it } from 'vitest'
import { clickToward, stepToward } from '@/nav/step.ts'

describe('stepToward', () => {
  it('descends from the wall into the pile under the cursor', () => {
    expect(stepToward([], ['beta', 'img-9'])).toEqual(['beta'])
  })

  it('descends from a pile into the card under the cursor', () => {
    expect(stepToward(['beta'], ['beta', 'img-9'])).toEqual(['beta', 'img-9'])
  })

  it('spends the step moving sideways when the cursor is over another pile', () => {
    // One step is either across or down, never both: the camera never arrives
    // somewhere the eye did not watch it go.
    expect(stepToward(['alpha'], ['beta', 'img-9'])).toEqual(['beta'])
  })

  it('moves sideways at the rung that diverged, not at the deepest one', () => {
    expect(stepToward(['alpha', 'img-1'], ['beta', 'img-9'])).toEqual(['beta'])
  })

  it('pages sideways between cards of the pile it is already in', () => {
    expect(stepToward(['alpha', 'img-1'], ['alpha', 'img-2'])).toEqual(['alpha', 'img-2'])
  })

  it('stays put when the cursor is over nothing', () => {
    expect(stepToward(['alpha'], [])).toBeNull()
  })

  it('stays put when there is nothing deeper under the cursor than where it already is', () => {
    expect(stepToward(['alpha'], ['alpha'])).toBeNull()
    expect(stepToward(['alpha', 'img-1'], ['alpha'])).toBeNull()
  })
})

describe('clickToward', () => {
  const front = (zone: string) => ({ weasel: 'w1', quiet: undefined })[zone as 'weasel']

  it('opens the zone/s top card from the wall, not the pile', () => {
    expect(clickToward([], ['weasel'], front)).toEqual(['weasel', 'w1'])
  })

  it('opens the top card from a click on a buried one, which is what was asked for', () => {
    expect(clickToward([], ['weasel', 'w9'], front)).toEqual(['weasel', 'w1'])
  })

  it('keeps the rung under shift', () => {
    expect(clickToward([], ['weasel'], front, true)).toEqual(['weasel'])
    expect(clickToward([], ['weasel', 'w9'], front, true)).toEqual(['weasel'])
  })

  it('focuses a zone that has no top card to open', () => {
    expect(clickToward([], ['quiet'], front)).toEqual(['quiet'])
  })

  it('steps as before from anywhere deeper than the wall', () => {
    expect(clickToward(['weasel'], ['weasel', 'w9'], front)).toEqual(['weasel', 'w9'])
    expect(clickToward(['weasel'], ['klieg'], front)).toEqual(['klieg'])
  })

  it('lands nowhere on the sky, which names no zone', () => {
    expect(clickToward([], [], front)).toBe(null)
  })
})
