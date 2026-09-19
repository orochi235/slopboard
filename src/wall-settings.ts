import { formatDuration } from '@shared/duration.ts'
import { HOLDS, isHold, type Lifetime } from '@shared/lifetime.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** The lifetimes the panel offers: minutes for watching a run land, hours for
 *  a working day, days for a wall left up over a weekend. */
export const TTL_CHOICES = [
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  4 * HOUR,
  8 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
] as const

/** The choices, with whatever the wall is set to now if that is not among them
 *  — a daemon started with `SLOP_TTL=5h` must not read as 15 minutes. */
export function ttlOptions(current: number): { value: string; label: string }[] {
  const all = TTL_CHOICES.includes(current as (typeof TTL_CHOICES)[number])
    ? [...TTL_CHOICES]
    : [...TTL_CHOICES, current].sort((a, b) => a - b)
  return all.map((ms) => ({ value: String(ms), label: formatDuration(ms) }))
}

/**
 * The same choices plus the two ways off the clock, for a zone.
 *
 * A zone only. The wall's own lifetime is bounded at ninety days in
 * `server/settings.ts` precisely to stop a setting under which nothing ever
 * leaves, and a wall-wide `eternal` is that failure wearing a friendlier word.
 * A zone is a deliberate exception to the wall, which is what makes it safe
 * there and not here.
 */
export function lifetimeOptions(current: Lifetime): { value: string; label: string }[] {
  const durations = ttlOptions(typeof current === 'number' ? current : TTL_CHOICES[0])
  return [...durations, ...HOLDS.map((hold) => ({ value: hold, label: hold }))]
}

/** A choice from `lifetimeOptions` back to what the daemon is sent. Null for
 *  anything unreadable, so a bad option never becomes a lifetime. */
export function lifetimeFromChoice(raw: string): Lifetime | null {
  if (isHold(raw)) return raw
  const ms = Number(raw)
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

/** What a lifetime shows as in the row that set it. */
export const lifetimeLabel = (lifetime: Lifetime): string =>
  isHold(lifetime) ? lifetime : formatDuration(lifetime)
