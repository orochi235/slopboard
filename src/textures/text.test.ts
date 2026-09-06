import { describe, expect, it } from 'vitest'
import { wrapLines } from '@/textures/text.ts'

/** One unit per character, so a width is a character count and the cases read
 *  as what they are testing rather than as font metrics. */
const ctx = {
  measureText: (s: string) => ({ width: s.length }),
} as unknown as CanvasRenderingContext2D

describe('wrapLines', () => {
  it('leaves text that fits on one line alone', () => {
    expect(wrapLines(ctx, 'build broken', 20, 2)).toEqual(['build broken'])
  })

  it('breaks at spaces rather than mid-word', () => {
    expect(wrapLines(ctx, 'build broken on main', 12, 2)).toEqual(['build broken', 'on main'])
  })

  it('cuts a word too long for any line, since a URL is exactly what lands here', () => {
    const [first] = wrapLines(ctx, 'aaaaaaaaaaaaaaaaaaaa', 8, 2)
    expect(first).toHaveLength(8)
  })

  it('ellipsises what it had to drop, and the ellipsis fits inside the width', () => {
    const out = wrapLines(ctx, 'one two three four five six seven', 9, 2)
    expect(out).toHaveLength(2)
    expect(out.at(-1)!.endsWith('…')).toBe(true)
    for (const line of out) expect(line.length).toBeLessThanOrEqual(9)
  })

  it('never returns more lines than it was allowed', () => {
    expect(wrapLines(ctx, 'a b c d e f g h i j k', 3, 2).length).toBeLessThanOrEqual(2)
  })

  it('answers empty text with one empty line rather than nothing to draw', () => {
    expect(wrapLines(ctx, '   ', 10, 2)).toEqual([''])
  })

  it('collapses runs of whitespace, so a pasted note does not wrap on nothing', () => {
    expect(wrapLines(ctx, 'build   broken', 20, 2)).toEqual(['build broken'])
  })
})
