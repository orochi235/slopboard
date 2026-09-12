import { describe, expect, it } from 'vitest'
import { directionFor, isForAControl, opensIn } from '@/nav/keys.ts'

describe('directionFor', () => {
  it('reads WASD as the arrows, so either hand navigates', () => {
    expect(directionFor({ key: 'w' })).toBe(directionFor({ key: 'ArrowUp' }))
    expect(directionFor({ key: 'a' })).toBe(directionFor({ key: 'ArrowLeft' }))
    expect(directionFor({ key: 's' })).toBe(directionFor({ key: 'ArrowDown' }))
    expect(directionFor({ key: 'd' })).toBe(directionFor({ key: 'ArrowRight' }))
    expect(directionFor({ key: 'w' })).toBe('up')
  })

  it('pages a pile on PageUp and PageDown, where left and right do', () => {
    expect(directionFor({ key: 'PageUp' })).toBe('left')
    expect(directionFor({ key: 'PageDown' })).toBe('right')
  })

  it('ignores case, so caps lock does not stop the wall', () => {
    expect(directionFor({ key: 'W' })).toBe('up')
  })

  it('leaves a modified keystroke to whoever owns it', () => {
    expect(directionFor({ key: 'w', metaKey: true })).toBeNull()
    expect(directionFor({ key: 'd', ctrlKey: true })).toBeNull()
    expect(directionFor({ key: 'ArrowUp', altKey: true })).toBeNull()
  })

  it('is null for a key the wall does not navigate by', () => {
    expect(directionFor({ key: 'q' })).toBeNull()
    expect(directionFor({ key: 'Escape' })).toBeNull()
    expect(directionFor({ key: ',' })).toBeNull()
  })
})

describe('opensIn', () => {
  it('opens on enter and on space, the two keys a list has always used', () => {
    expect(opensIn({ key: 'Enter' })).toBe(true)
    expect(opensIn({ key: ' ' })).toBe(true)
  })

  it('leaves a modified keystroke to whoever owns it', () => {
    expect(opensIn({ key: 'Enter', metaKey: true })).toBe(false)
    expect(opensIn({ key: ' ', ctrlKey: true })).toBe(false)
    expect(opensIn({ key: 'Enter', altKey: true })).toBe(false)
  })

  it('is false for the keys that navigate and the one that climbs out', () => {
    expect(opensIn({ key: 'ArrowRight' })).toBe(false)
    expect(opensIn({ key: 'w' })).toBe(false)
    expect(opensIn({ key: 'Escape' })).toBe(false)
  })
})

describe('isForAControl', () => {
  // The tests run without a DOM, so the target is faked the way the rest of
  // this repo fakes one: a `closest` that answers for a known selector.
  const target = (matches: string) =>
    ({ closest: (sel: string) => (sel.includes(matches) ? {} : null) }) as unknown as EventTarget

  it('claims a keystroke aimed at a field or a slider for the control', () => {
    expect(isForAControl(target('input'))).toBe(true)
    expect(isForAControl(target('select'))).toBe(true)
    expect(isForAControl(target('contenteditable'))).toBe(true)
  })

  it('leaves the wall itself alone', () => {
    expect(isForAControl(target('nothing-it-asks-about'))).toBe(false)
    expect(isForAControl(null)).toBe(false)
  })

  it('survives a target with no closest, which is not an element', () => {
    expect(isForAControl({} as EventTarget)).toBe(false)
  })
})
