import { describe, expect, it } from 'vitest'
import { nextOpen, posterIndex, posterOf, posterTake, runBadge, runIsOpen } from './runs.ts'
import type { Take, WallItem } from './protocol.ts'

const take = (id: string, answered?: string): Take => ({
  id,
  url: `/img/${id}`,
  origUrl: `/orig/${id}`,
  name: id,
  path: `/inbox/${id}.png`,
  at: 0,
  w: 100,
  h: 50,
  question: 'how does this read?',
  ...(answered === undefined ? {} : { reply: { status: 'answered' as const, choice: answered, text: '', at: 1 } }),
})

const run = (takes: Take[], of?: number): WallItem =>
  ({ id: 'r', kind: 'run', takes, ...(of === undefined ? {} : { run: { of } }) }) as WallItem

describe('the take a run draws', () => {
  it('is the first unanswered', () => {
    expect(posterTake([take('a', 'fixed'), take('b'), take('c')])?.id).toBe('b')
    expect(posterIndex([take('a', 'fixed'), take('b'), take('c')])).toBe(2)
  })

  it('settles on the last once every take is answered', () => {
    const takes = [take('a', 'fixed'), take('b', 'worse')]
    expect(posterTake(takes)?.id).toBe('b')
    expect(runIsOpen(run(takes))).toBe(false)
  })

  it('treats a dismissed take as closed, so the poster moves past it', () => {
    const takes = [take('a'), take('b')]
    takes[0]!.reply = { status: 'dismissed', text: '', at: 1 }
    expect(posterTake(takes)?.id).toBe('b')
  })

  it('carries the poster take/s size, not the run/s first', () => {
    const takes = [take('a', 'fixed'), take('b')]
    takes[1]!.w = 640
    expect(posterOf(takes)).toEqual({ url: '/img/b', origUrl: '/orig/b', w: 640, h: 50 })
  })
})

describe('the badge', () => {
  it('counts to the total the run declared', () => {
    expect(runBadge(run([take('a'), take('b')], 12))).toBe('1/12')
  })

  it('marks the total unknown where the run never said', () => {
    expect(runBadge(run([take('a', 'fixed'), take('b')]))).toBe('2/2+')
  })

  it('marks it unknown too when more arrived than the run promised', () => {
    expect(runBadge(run([take('a'), take('b'), take('c')], 2))).toBe('1/3+')
  })
})

describe('advancing', () => {
  it('goes to the next unanswered take, not the next take', () => {
    const takes = [take('a', 'fixed'), take('b', 'worse'), take('c')]
    expect(nextOpen(takes, 'a')?.id).toBe('c')
  })

  it('wraps back to an earlier open take rather than closing', () => {
    const takes = [take('a'), take('b', 'fixed')]
    expect(nextOpen(takes, 'b')?.id).toBe('a')
  })

  it('is null once nothing is open', () => {
    expect(nextOpen([take('a', 'fixed')], 'a')).toBe(null)
  })
})
