import { formatDuration, parseDuration } from './duration.ts'

/**
 * How long a zone holds what lands in it: a duration, or one of two ways of
 * saying "not on a clock".
 *
 * The two differ in what may still take the artifact later, which is the only
 * thing that separates them — neither ever expires on its own.
 *
 *   indefinite  off the clock, ordinary in every other way. Whatever
 *               collector the wall grows — a count cap, a disk budget — takes
 *               it like anything else.
 *   eternal     exempt from all of that, now and from anything added later.
 *               The zone-wide form of a rescue.
 *
 * Shared because the sweeper resolves it every pass and the sheet offers it.
 */
export const HOLDS = ['indefinite', 'eternal'] as const

export type Hold = (typeof HOLDS)[number]

export type Lifetime = number | Hold

export const isHold = (v: unknown): v is Hold =>
  typeof v === 'string' && (HOLDS as readonly string[]).includes(v)

/** What the sweeper compares against. `Infinity` for either hold, so the one
 *  comparison in `startSweeper` needs no case of its own. */
export const lifetimeMs = (lifetime: Lifetime): number =>
  typeof lifetime === 'number' ? lifetime : Infinity

/** Whether a bulk expire passes over it. True only for `eternal`: taking a
 *  whole zone at once is the collector this promise is against, while the
 *  card's own Expire is a deliberate act on one artifact and always lands. */
export const isEternal = (lifetime: Lifetime | undefined): boolean => lifetime === 'eternal'

/** How it is written in `zones.json`, which is a file someone may open. A
 *  duration goes the way `TRANSOM_TTL` takes it; a hold goes as its own word. */
export const formatLifetime = (lifetime: Lifetime): string =>
  typeof lifetime === 'number' ? formatDuration(lifetime) : lifetime

/** The inverse, returning null for anything unreadable so the caller decides
 *  what that costs rather than inheriting a wrong number silently. */
export function parseLifetime(text: string): Lifetime | null {
  const held = text.trim()
  if (isHold(held)) return held
  return parseDuration(held)
}
