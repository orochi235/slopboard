import { describe, expect, it } from 'vitest'
import { parseHued } from '@shared/hued.ts'

describe('parseHued', () => {
  it('reads a hex value whose own hash is not a comment', () => {
    expect(parseHued('background=#b9a281')).toEqual({ background: '#b9a281' })
  })

  it('drops a trailing comment but keeps the hash that starts the value', () => {
    expect(parseHued('background=#b9a281  # taupe')).toEqual({ background: '#b9a281' })
    expect(parseHued('background=#6a5acd  # slateblue').background).toBe('#6a5acd')
  })

  it('ignores the banner comment every file opens with', () => {
    const text = '# https://github.com/orochi235/hued\nbackground=#470013\naccent=#89fe05  # limegreen\n'
    expect(parseHued(text)).toEqual({ background: '#470013', accent: '#89fe05' })
  })

  it('keeps a named color, which some projects use instead of hex', () => {
    expect(parseHued('background=yellow\nforeground=black')).toEqual({
      background: 'yellow',
      foreground: 'black',
    })
  })

  it('ignores keys it does not know and lines that are not assignments', () => {
    expect(parseHued('theme=dark\njust some text\nbackground=#111111')).toEqual({
      background: '#111111',
    })
  })

  it('is empty for an empty or comment-only file', () => {
    expect(parseHued('')).toEqual({})
    expect(parseHued('# nothing here\n')).toEqual({})
  })
})
