import { describe, expect, it } from 'vitest'
import { idFor, idFromOrig, origUrlFor } from './itemId.ts'

describe('idFor', () => {
  it('gives the same artifact the same id across daemon restarts', () => {
    const path = '/Users/x/slop/inbox/weasel/a.png'
    expect(idFor(path)).toBe(idFor(path))
  })

  it('separates artifacts that differ only by zone', () => {
    expect(idFor('/slop/inbox/alpha/a.png')).not.toBe(idFor('/slop/inbox/beta/a.png'))
  })

  it('is a url-safe token, since it is spent in a path', () => {
    expect(idFor('/slop/inbox/z/a.png')).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('origUrlFor', () => {
  it('carries the source extension, lowercased, and round-trips to the id', () => {
    const id = idFor('/slop/inbox/z/A.PNG')
    const url = origUrlFor(id, '/slop/inbox/z/A.PNG')
    expect(url).toBe(`/orig/${id}.png`)
    expect(idFromOrig(url.slice('/orig/'.length))).toBe(id)
  })

  it('still resolves a bare id, which cards already on a wall hold', () => {
    expect(idFromOrig('8f5b391b259c1d6c9651e7f7cd57c2c8')).toBe('8f5b391b259c1d6c9651e7f7cd57c2c8')
  })
})
