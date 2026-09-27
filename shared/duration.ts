const MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/**
 * A TTL as written by a person: `60`, `90s`, `5m`, `24h`, `2d`. A bare number is
 * seconds, which is what `TRANSOM_TTL` has always meant. Returns null rather than a
 * fallback so a caller decides what an unreadable value costs — silently
 * treating `5x` as five seconds would expire a card in the time it takes to look.
 */
export function parseDuration(text: string): number | null {
  const match = /^(\d+(?:\.\d+)?)([smhd]?)$/i.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * (match[2] ? MS[match[2].toLowerCase()]! : 1000)
}

/** The inverse of `parseDuration`, in the largest unit that divides evenly —
 *  what a person would have written. Anything under a second keeps its ms,
 *  which `parseDuration` cannot read back; nothing writes one. */
export function formatDuration(ms: number): string {
  for (const unit of ['d', 'h', 'm', 's'] as const) {
    const size = MS[unit]!
    if (ms >= size && ms % size === 0) return `${ms / size}${unit}`
  }
  return `${ms}ms`
}

/**
 * A runtime, as a clock reads it: `0:12`, `4:03`, `1:02:33`. The hour appears
 * only when there is one, and the minute is padded only under it — which is
 * what separates this from `formatDuration`'s `5m`. Seconds are floored, so a
 * badge never claims a second the video does not have.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
