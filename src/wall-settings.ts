import { formatDuration } from '@shared/duration.ts'

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
