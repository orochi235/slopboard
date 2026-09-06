import { describe, expect, it } from 'vitest'
import { idFor } from './itemId.ts'

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
