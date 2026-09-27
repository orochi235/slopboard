import { describe, expect, it } from 'vitest'
import { askChip, askWords, asksOf, cornerChip } from '@/asks.ts'
import type { Markup, Reply, Take, WallItem } from '@shared/protocol.ts'

const answered: Reply = { status: 'answered', choice: 'better', text: '', at: 2 }

const item = (over: Partial<WallItem> = {}): WallItem => ({
  id: 'a',
  url: '/img/a',
  origUrl: '/orig/a',
  zone: 'z',
  name: 'a',
  path: '/transom/inbox/z/a.png',
  bornAt: 1,
  w: 10,
  h: 10,
  ...over,
})

const take = (id: string, reply?: Reply): Take => ({
  id,
  url: `/img/${id}`,
  origUrl: `/orig/${id}`,
  name: id,
  path: `/transom/inbox/z/${id}.png`,
  at: 1,
  w: 10,
  h: 10,
  question: 'reads?',
  ...(reply ? { reply } : {}),
})

describe('what a card asks', () => {
  it('is nothing for an ordinary artifact', () => {
    expect(asksOf(item())).toBe(null)
    expect(asksOf(item({ kind: 'run', takes: [{ ...take('t1'), question: undefined }] }))).toBe(null)
  })

  it('is open while a question has no reply, and closed once it has one', () => {
    expect(asksOf(item({ question: 'reads?' }))).toEqual({ open: true, count: 1, answered: 0 })
    expect(asksOf(item({ question: 'reads?', reply: answered }))).toEqual({
      open: false,
      count: 1,
      answered: 1,
    })
  })

  it('counts a run by its takes, and stays open while any is waiting', () => {
    const takes = [take('t1', answered), take('t2'), take('t3')]
    expect(asksOf(item({ kind: 'run', takes }))).toEqual({ open: true, count: 3, answered: 1 })
  })

  it('closes a run only when nothing in it is waiting', () => {
    const takes = [take('t1', answered), take('t2', { status: 'dismissed', text: '', at: 3 })]
    expect(asksOf(item({ kind: 'run', takes }))?.open).toBe(false)
  })
})

describe('the chip', () => {
  it('is a bare glyph for one question, since a count of one says nothing', () => {
    expect(askChip({ open: true, count: 1, answered: 0 })).toBe('?')
    expect(askChip({ open: false, count: 1, answered: 1 })).toBe('✓')
  })

  it('counts what a run has left, not what it has done', () => {
    expect(askChip({ open: true, count: 12, answered: 3 })).toBe('? 9')
  })

  it('counts the whole run once it is finished', () => {
    expect(askChip({ open: false, count: 12, answered: 12 })).toBe('✓ 12')
  })
})

describe('the same thing in words', () => {
  it('asks for a response, then reports one', () => {
    const open = item({ question: 'reads?' })
    expect(askWords(open, asksOf(open)!)).toBe('needs a response')
    const shut = item({ question: 'reads?', reply: answered })
    expect(askWords(shut, asksOf(shut)!)).toBe('responded')
  })

  it('says how a question closed where nobody answered it', () => {
    for (const status of ['dismissed', 'expired'] as const) {
      const shut = item({ question: 'reads?', reply: { status, text: '', at: 2 } })
      expect(askWords(shut, asksOf(shut)!)).toBe(status)
    }
  })
})

const marked = (status: Markup['status']): Markup => ({ status, text: '', at: 1, url: '/api/marks/a.png', live: false })

describe('the corner', () => {
  it('shows unsent marks over a question, since they are what would be lost', () => {
    expect(cornerChip(item({ question: 'reads?', markup: marked('pending') }))).toEqual({ text: '✎', open: true })
  })

  it('finds them on a run take too', () => {
    const run = item({ kind: 'run', takes: [{ ...take('t1'), markup: marked('pending') }] })
    expect(cornerChip(run)?.text).toBe('✎')
  })

  it('goes back to the question once they are sent or thrown away', () => {
    expect(cornerChip(item({ question: 'reads?', markup: marked('delivered') }))).toEqual({ text: '?', open: true })
    expect(cornerChip(item({ markup: marked('discarded') }))).toBeNull()
  })

  it('says a question closed by a drawing was marked up', () => {
    const shut = item({ question: 'reads?', reply: { status: 'marked', text: '', at: 2 } })
    expect(askWords(shut, asksOf(shut)!)).toBe('marked up')
  })
})
