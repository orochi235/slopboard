const MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/**
 * A TTL as written by a person: `60`, `90s`, `5m`, `24h`, `2d`. A bare number is
 * seconds, which is what `SLOP_TTL` has always meant. Returns null rather than a
 * fallback so a caller decides what an unreadable value costs — silently
 * treating `5x` as five seconds would expire a card in the time it takes to look.
 */
export function parseDuration(text: string): number | null {
  const match = /^(\d+(?:\.\d+)?)([smhd]?)$/i.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * (match[2] ? MS[match[2].toLowerCase()]! : 1000)
}
