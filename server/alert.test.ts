import { describe, expect, it } from 'vitest'
import { ALERTS, LEVELS } from '@shared/attention.ts'
import { debugItem, planFor, toastFor } from './alert.ts'

describe('planFor', () => {
  it('does nothing for an arrival that is not asking', () => {
    expect(planFor(null, false)).toEqual({ sound: false, notify: false, raise: 'none' })
  })

  it('keeps everything but the sound for a quiet card', () => {
    expect(planFor('problem', true, true)).toEqual({ sound: false, notify: true, raise: 'front' })
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

describe('debugItem', () => {
  it('carries the level, so the plan it fires is the level’s own', () => {
    for (const level of LEVELS) {
      expect(debugItem(level).attention?.level).toBe(level)
      expect(planFor(debugItem(level).attention?.level ?? null, true)).toEqual({
        sound: ALERTS[level].sound,
        notify: ALERTS[level].notify,
        raise: ALERTS[level].raise ? 'front' : 'none',
      })
    }
  })

  it('wears a note nobody mistakes for a real one', () => {
    expect(debugItem('problem').note).toMatch(/debug/)
    expect(debugItem('problem').zone).toBe('debug')
  })
})

describe('toastFor', () => {
  const item = { ...debugItem('urgent'), zone: 'renders', repo: 'transom', sha: 'abc1234' }

  it('owes a toast for every sound, and none for a silent arrival', () => {
    expect(toastFor(item, planFor('urgent', true))).not.toBeNull()
    expect(toastFor({ ...item, attention: { level: 'look', holdMs: null } }, planFor('look', true))).toBeNull()
    expect(toastFor({ ...item, attention: undefined }, planFor(null, true))).toBeNull()
  })

  it('says where the sound came from and what it wants', () => {
    const toast = toastFor(item, planFor('urgent', true))
    expect(toast).toMatchObject({ zone: 'renders', level: 'urgent', repo: 'transom', sha: 'abc1234' })
    expect(toast?.asks).toBe(item.note)
  })

  it('leads with the question when there is one, and falls back to the name', () => {
    expect(toastFor({ ...item, question: 'which crop?' }, planFor('urgent', true))?.asks).toBe('which crop?')
    const { note: _none, ...bare } = item
    expect(toastFor(bare, planFor('urgent', true))?.asks).toBe(item.name)
  })
})
