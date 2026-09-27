import type { Reply, WallItem } from '@shared/protocol.ts'

/**
 * Whether a card is waiting on an answer, and how far through one it is.
 *
 * A flag lapses and a plate goes with it, but a question stays open until
 * someone closes it -- so the plate cannot be the wall's only sign that
 * something is waiting, and it is no sign at all that something *was*. This is
 * what the corner chip reads.
 */
export type Asks = {
  /** Something is still waiting on a reply. */
  open: boolean
  /** How many questions the card carries: one, or a run's takes. */
  count: number
  answered: number
}

/** Null for an artifact that asks nothing, which is most of the wall. */
export function asksOf(item: WallItem): Asks | null {
  if (item.kind === 'run') {
    const asking = (item.takes ?? []).filter((t) => t.question !== undefined)
    if (asking.length === 0) return null
    const answered = asking.filter((t) => t.reply !== undefined).length
    return { open: answered < asking.length, count: asking.length, answered }
  }
  if (item.question === undefined) return null
  return { open: item.reply === undefined, count: 1, answered: item.reply ? 1 : 0 }
}

/** Still waiting. Struck in the flag's own color, so it reads as signage rather
 *  than as one more fact about the file. */
export const ASK_GLYPH = '?'
/** Answered, dismissed or expired: a record rather than a task, so it wears the
 *  ordinary chip colors. */
export const DONE_GLYPH = '✓'

/**
 * The corner chip. A bare glyph for one question, since "1" would say nothing;
 * a run counts, because how many are left is the whole reason to look.
 */
export function askChip(asks: Asks): string {
  if (asks.count === 1) return asks.open ? ASK_GLYPH : DONE_GLYPH
  return asks.open
    ? `${ASK_GLYPH} ${asks.count - asks.answered}`
    : `${DONE_GLYPH} ${asks.count}`
}

/** Drawn on and sent back, but not yet collected by the session that sent it.
 *  In the flag's color like an open question: it is holding the card up. */
export const MARKS_GLYPH = '✎'

/** Whether a card, or any take in it, holds a drawing its sender has not got. */
export function holdsMarks(item: WallItem): boolean {
  if (item.markup?.status === 'pending') return true
  return (item.takes ?? []).some((t) => t.markup?.status === 'pending')
}

/**
 * What the bottom-right corner says: unsent marks over everything, since they
 * are the one thing on the card that is lost if nobody acts; else the question.
 */
export function cornerChip(item: WallItem): { text: string; open: boolean } | null {
  if (holdsMarks(item)) return { text: MARKS_GLYPH, open: true }
  const state = asksOf(item)
  return state ? { text: askChip(state), open: state.open } : null
}

/** How a question closed, in the words the wall shows for it. */
export function replyWords(reply: Reply): string {
  return reply.status === 'marked' ? 'marked up' : reply.status
}

/**
 * The same thing in words, for the lightbox's status row where there is room
 * for them. A question closed without an answer says how it closed instead:
 * "responded" would be a claim nobody made.
 */
export function askWords(item: WallItem, asks: Asks): string {
  if (asks.open) return 'needs a response'
  if (item.kind === 'run') return 'responded'
  return item.reply && item.reply.status !== 'answered' ? replyWords(item.reply) : 'responded'
}
