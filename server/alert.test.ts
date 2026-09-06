import { describe, expect, it } from 'vitest'
import { planFor } from './alert.ts'

describe('planFor', () => {
  it('does nothing for an arrival that is not asking', () => {
    expect(planFor(null, false)).toEqual({ sound: false, notify: false, raise: 'none' })
  })

  it('leaves the screen alone for a level that only wants to be noticed', () => {
    expect(planFor('look', false).raise).toBe('none')
    expect(planFor('look', false).sound).toBe(false)
    expect(planFor('urgent', false).raise).toBe('none')
  })

  it('starts the wall when the loudest level lands and nothing is connected', () => {
    expect(planFor('problem', false).raise).toBe('start')
  })

  it('only brings it forward when it is already running', () => {
    expect(planFor('problem', true).raise).toBe('front')
  })
})
