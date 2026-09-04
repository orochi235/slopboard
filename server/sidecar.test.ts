import { describe, expect, it } from 'vitest'
import { parseStamp, sidecarFor } from './sidecar.ts'

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

  it('is empty for anything that is not an object', () => {
    expect(parseStamp(null)).toEqual({})
    expect(parseStamp('caption')).toEqual({})
    expect(parseStamp(['caption'])).toEqual({})
  })
})
