import type { Poster, Take, WallItem } from './protocol.ts'

/**
 * What a group's card stands for, in one place because the daemon and the wall
 * both have to agree on it: which take the card draws, how the badge counts,
 * and when the group still has someone waiting on it.
 */

/**
 * How many takes one group may hold. Without a cap the only bound on a card's
 * size is how long the agent runs, and the carousel is the wrong instrument
 * for a corpus. `bin/transom` refuses the send past this too, so the wall says no
 * in front of whoever typed it as well as behind them.
 */
export const MAX_TAKES = 60

export const isGroup = (item: WallItem): boolean => item.kind === 'group'

/** A take with a question nobody has closed. */
export const takeIsOpen = (take: Take): boolean =>
  take.question !== undefined && take.reply === undefined

/**
 * The take the card draws: the first unanswered, so the card shows what it
 * wants from you and works through the group visibly as you answer. Once every
 * take is answered it settles on the last.
 */
export const posterTake = (takes: readonly Take[]): Take | undefined =>
  takes.find(takeIsOpen) ?? takes[takes.length - 1]

/** The poster as the item carries it. Null for a group with no takes, which the
 *  store never builds — a group's card is opened by its first take. */
export function posterOf(takes: readonly Take[]): Poster | null {
  const take = posterTake(takes)
  if (!take) return null
  return { url: take.url, origUrl: take.origUrl, w: take.w, h: take.h }
}

/** Where the poster sits in the group, counting from 1 for the badge. Zero for
 *  a group with no takes. */
export const posterIndex = (takes: readonly Take[]): number => {
  const take = posterTake(takes)
  return take ? takes.indexOf(take) + 1 : 0
}

/**
 * Where one take sits in its group, counting from 0. A group that never said how
 * many were coming reads `3/7+` — the count so far is true and the total is
 * not known, and a bare `3/7` would claim it was.
 */
export function countOf(item: WallItem, at: number): string {
  const takes = item.takes ?? []
  const of = item.group?.of
  return `${at + 1}/${of !== undefined && of >= takes.length ? of : `${takes.length}+`}`
}

/** What the card's badge says: which take is on it, out of how many are coming. */
export const groupBadge = (item: WallItem): string =>
  countOf(item, posterIndex(item.takes ?? []) - 1)

/** True while any take is still waiting on a verdict. The group is the unit of
 *  lifetime, so one open take holds the whole card off the clock. */
export const groupIsOpen = (item: WallItem): boolean => (item.takes ?? []).some(takeIsOpen)

/** The take after the one just answered, skipping anything already closed —
 *  what answering advances to, and null when the group is done. */
export function nextOpen(takes: readonly Take[], from: string): Take | null {
  const at = takes.findIndex((t) => t.id === from)
  if (at === -1) return takes.find(takeIsOpen) ?? null
  const after = takes.slice(at + 1).find(takeIsOpen)
  return after ?? takes.slice(0, at).find(takeIsOpen) ?? null
}
