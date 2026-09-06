import { parseDuration } from './duration.ts'

/**
 * How hard an item asks to be looked at. `level` names the treatment, so the
 * set can grow without a sidecar migration; `holdMs` is null when the item
 * holds its emphasis until someone dismisses it.
 */
export type Attention = { level: Level; holdMs: number | null }

/**
 * The treatments the wall knows. Presets rather than points on a scale: a
 * serious problem and a deadline are different kinds of asking, not different
 * volumes of it, so there is no ordering between them to get wrong. Adding one
 * is an entry here and a row in the params table it drives — never a change to
 * the ingest contract.
 */
export const LEVELS = ['look', 'soon', 'urgent', 'problem'] as const
export type Level = (typeof LEVELS)[number]

const DEFAULT_LEVEL: Level = 'look'

/**
 * How long each level holds when the caller does not say. Null holds until
 * someone dismisses it, which is right for everything except a deadline: a
 * passed deadline is exactly when a card should stop asking, so `soon` is the
 * one that lapses on its own.
 */
export const DEFAULT_HOLD: Record<Level, number | null> = {
  look: null,
  soon: 1_800_000,
  urgent: null,
  problem: null,
}

const UNTIL_DISMISSED = 'until-dismissed'

const isLevel = (text: string): text is Level => (LEVELS as readonly string[]).includes(text)

/**
 * The `attention` token as an agent writes it: `look`, `30m`, `look:90s`,
 * `until-dismissed`. Null for anything unreadable rather than a fallback,
 * because a typo that quietly became a flag at the default strength would be
 * indistinguishable from one that was meant — and because `shout` must not
 * start working by accident the day a second level is added.
 */
export function parseAttention(token: string): Attention | null {
  const text = token.trim().toLowerCase()
  if (text === '') return null

  const cut = text.indexOf(':')
  const [head, tail] = cut === -1 ? [text, null] : [text.slice(0, cut), text.slice(cut + 1)]

  if (tail === null) {
    if (head === UNTIL_DISMISSED) return { level: DEFAULT_LEVEL, holdMs: null }
    if (isLevel(head)) return { level: head, holdMs: DEFAULT_HOLD[head] }
    const holdMs = parseDuration(head)
    return holdMs === null ? null : { level: DEFAULT_LEVEL, holdMs }
  }

  if (!isLevel(head)) return null
  if (tail === UNTIL_DISMISSED) return { level: head, holdMs: null }
  const holdMs = parseDuration(tail)
  return holdMs === null ? null : { level: head, holdMs }
}

/**
 * How loudly an item is still asking, 0..1. A step rather than a ramp: the
 * flag is live or it is not, and softening the end is the renderer's business
 * if the drop ever reads badly.
 */
export function emphasisAt(
  attention: Attention | null | undefined,
  bornAt: number,
  now: number,
): number {
  if (!attention) return 0
  if (attention.holdMs === null) return 1
  return now - bornAt < attention.holdMs ? 1 : 0
}
