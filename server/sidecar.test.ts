import { describe, expect, it } from 'vitest'
import { keptFrom, parseStamp, sidecarFor } from './sidecar.ts'

describe('sidecarFor', () => {
  it('sits beside the image, keeping the extension so two images never collide', () => {
    expect(sidecarFor('/i/a.png')).toBe('/i/a.png.slop.json')
    expect(sidecarFor('/i/a.jpg')).not.toBe(sidecarFor('/i/a.png'))
  })
})

describe('parseStamp', () => {
  it('takes the fields the wall knows', () => {
    expect(parseStamp({ caption: 'a', zone: 'z', repo: 'r', sha: 'abc1234' })).toEqual({
      caption: 'a',
      zone: 'z',
      repo: 'r',
      sha: 'abc1234',
    })
  })

  it('drops a key it does not know, so a sidecar cannot inject one', () => {
    expect(parseStamp({ caption: 'a', ttlMs: 5, url: '/evil' })).toEqual({ caption: 'a' })
  })

  it('ignores a value of the wrong type or an empty one', () => {
    expect(parseStamp({ caption: 12, zone: '', repo: null })).toEqual({})
  })

  it('takes the choices as a list of strings, dropping anything else in it', () => {
    expect(parseStamp({ question: 'q', choices: ['a', 3, '', 'b'] })).toEqual({ question: 'q', choices: ['a', 'b'] })
    expect(parseStamp({ choices: 'a' })).toEqual({})
    expect(parseStamp({ choices: [] })).toEqual({})
  })

  it('is empty for anything that is not an object', () => {
    expect(parseStamp(null)).toEqual({})
    expect(parseStamp('caption')).toEqual({})
    expect(parseStamp(['caption'])).toEqual({})
  })
})

describe('keptFrom', () => {
  it('reads the rescue back as a moment', () => {
    expect(keptFrom({ kept: '2026-09-05T12:00:00.000Z' })).toBe(Date.parse('2026-09-05T12:00:00Z'))
  })

  it('is null for no sidecar, no rescue, or a date nobody can read', () => {
    expect(keptFrom(null)).toBeNull()
    expect(keptFrom({ caption: 'a' })).toBeNull()
    expect(keptFrom({ kept: 'soon' })).toBeNull()
  })
})
