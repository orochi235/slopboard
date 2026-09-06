const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * How old something is, in one unit. The wall's own register: `4m`, `2h`, and
 * never `4 minutes ago`, because it sits next to a note and must not outweigh
 * it.
 */
export function ago(ms: number): string {
  const age = Math.max(0, ms)
  if (age < MINUTE) return `${Math.floor(age / 1000)}s`
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`
  if (age < DAY) return `${Math.floor(age / HOUR)}h`
  return `${Math.floor(age / DAY)}d`
}
