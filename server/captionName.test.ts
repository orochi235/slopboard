import { describe, expect, it } from 'vitest'
import { captionFor, captionFromName } from './captionName.ts'

describe('captionFromName', () => {
  it('drops the extension', () => {
    expect(captionFromName('render.png')).toBe('render')
  })

  it('drops a TTL segment, which is protocol rather than name', () => {
    expect(captionFromName('render.ttl5m.png')).toBe('render')
    expect(captionFromName('wall-borders.ttl900.png')).toBe('wall-borders')
  })

  it('keeps dots that are part of the name', () => {
    expect(captionFromName('v1.2.final.png')).toBe('v1.2.final')
  })

  it('keeps a name that has no extension at all', () => {
    expect(captionFromName('README')).toBe('README')
  })
})

describe('captionFor', () => {
  it('takes the sidecar at its word when there is one', () => {
    expect(captionFor('7304CB52-827D.png', { caption: 'the sky, turned' })).toBe('the sky, turned')
  })

  it('captions nothing rather than a UUID when the sidecar has no caption', () => {
    // `some-generator | slop` has no source name to fall back to, and a hex
    // string is worse than an empty caption.
    expect(captionFor('7304CB52-827D-4768.png', {})).toBe('')
    expect(captionFor('7304CB52-827D-4768.png', { repo: 'slopboard' })).toBe('')
  })

  it('reads the filename only for a file dropped in by hand', () => {
    expect(captionFor('render.ttl5m.png', null)).toBe('render')
  })
})
