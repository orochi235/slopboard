import { describe, expect, it } from 'vitest'
import { kindOf } from './kind.ts'

describe('kindOf', () => {
  it('reads the extensions the wall already holds as pictures', () => {
    expect(kindOf('/slop/inbox/z/a.png')).toBe('image')
    expect(kindOf('/slop/inbox/z/a.JPG')).toBe('image')
    expect(kindOf('/slop/inbox/z/a.webp')).toBe('image')
  })

  it('reads a self-contained page', () => {
    expect(kindOf('/slop/inbox/z/a.html')).toBe('page')
    expect(kindOf('/slop/inbox/z/a.HTM')).toBe('page')
  })

  it('is null for anything the wall cannot hold', () => {
    // The sidecar lands in the same directory and must never be ingested.
    expect(kindOf('/slop/inbox/z/a.png.slop.json')).toBe(null)
    expect(kindOf('/slop/inbox/z/a.pdf')).toBe(null)
    expect(kindOf('/slop/inbox/z/a')).toBe(null)
  })
})
