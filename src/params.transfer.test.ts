import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/params.ts'
import { fromText, toText } from '@/params.transfer.ts'

describe('toText', () => {
  it('writes JSON that can be pasted into a source file', () => {
    const text = toText(defaultParams)
    expect(text).toContain('\n  ')
    expect(JSON.parse(text).camera.projection).toBe('orthographic')
  })
})

describe('fromText', () => {
  it('round-trips a tuned set', () => {
    const tuned = { ...defaultParams, side: 0.5, camera: { ...defaultParams.camera, moveMs: 90 } }
    const back = fromText(defaultParams, toText(tuned))
    expect(back?.side).toBe(0.5)
    expect(back?.camera.moveMs).toBe(90)
  })

  it('refuses text that is not JSON rather than throwing at the panel', () => {
    expect(fromText(defaultParams, 'not json {')).toBeNull()
    expect(fromText(defaultParams, '')).toBeNull()
  })

  it('refuses JSON that is not an object of parameters', () => {
    expect(fromText(defaultParams, '[1,2,3]')).toBeNull()
    expect(fromText(defaultParams, '42')).toBeNull()
    expect(fromText(defaultParams, 'null')).toBeNull()
  })

  it('fills in a parameter the text predates, so an old export still loads', () => {
    const { nav, ...older } = defaultParams
    expect(fromText(defaultParams, JSON.stringify(older))?.nav).toEqual(defaultParams.nav)
  })

  it('drops a key the params no longer have', () => {
    const text = JSON.stringify({ ...defaultParams, retired: 7 })
    expect(fromText(defaultParams, text)).not.toHaveProperty('retired')
  })

  it('ignores a value whose type disagrees, which is a rename and not a tuning', () => {
    const text = JSON.stringify({ ...defaultParams, side: 'wide' })
    expect(fromText(defaultParams, text)?.side).toBe(defaultParams.side)
  })
})
