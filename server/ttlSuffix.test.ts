import { describe, expect, it } from 'vitest'
import { ttlFromName } from './ttlSuffix.ts'

describe('ttlFromName', () => {
  it('reads the .ttl<duration> segment before the extension', () => {
    expect(ttlFromName('a1b2.ttl60.png')).toBe(60_000)
    expect(ttlFromName('render.ttl5m.webp')).toBe(300_000)
    expect(ttlFromName('shot.ttl24h.jpg')).toBe(86_400_000)
  })

  it('is null when there is no ttl segment, so the caller uses its default', () => {
    expect(ttlFromName('plain.png')).toBeNull()
    expect(ttlFromName('a.b.c.png')).toBeNull()
  })

  it('is null when the segment is present but unreadable', () => {
    expect(ttlFromName('x.ttlsoon.png')).toBeNull()
    expect(ttlFromName('x.ttl.png')).toBeNull()
  })

  it('does not match a ttl-looking word that is not its own segment', () => {
    expect(ttlFromName('myttl60.png')).toBeNull()
    expect(ttlFromName('battle60.png')).toBeNull()
  })

  it('survives a name with no extension at all', () => {
    expect(ttlFromName('bare')).toBeNull()
  })
})
