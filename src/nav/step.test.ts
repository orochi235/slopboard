import { describe, expect, it } from 'vitest'
import { stepToward } from '@/nav/step.ts'

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
