import { describe, expect, it } from 'vitest'
import { captionFromName } from './captionName.ts'

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
