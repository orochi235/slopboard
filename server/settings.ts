import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.ts'
import { formatDuration, parseDuration } from '@shared/duration.ts'

const file = join(config.root, 'settings.json')

/**
 * What the wall itself is set to, as opposed to how it is drawn: the settings
 * panel writes drawing into the browser, and this into the daemon, because a
 * lifetime decides when files move to the trash rather than how they look.
 *
 * A file of its own, holding durations the way a person writes them — the same
 * `8h` `SLOP_TTL` takes. The environment is the fallback, so a machine that has
 * never been set keeps behaving the way its launcher says.
 */
const bounds = { min: 60_000, max: 90 * 86_400_000 }

let ttl: number | null = null

export async function load(): Promise<void> {
  try {
    const blob = JSON.parse(await readFile(file, 'utf8')) as { ttl?: unknown }
    ttl = typeof blob.ttl === 'string' ? inBounds(parseDuration(blob.ttl)) : null
  } catch {
    // No file yet, or one nobody can read. Either way the environment answers.
    ttl = null
  }
}

const inBounds = (ms: number | null): number | null =>
  ms !== null && Number.isFinite(ms) && ms >= bounds.min && ms <= bounds.max ? ms : null

/** How long an artifact lives when it does not carry its own TTL. */
export const ttlMs = (): number => ttl ?? config.ttlMs

/** The lifetime as set, or null for one the wall will not hold — too short to
 *  read, or so long that nothing ever leaves. */
export async function setTtl(ms: number): Promise<number | null> {
  const held = inBounds(ms)
  if (held === null) return null
  ttl = held
  await writeFile(file, `${JSON.stringify({ ttl: formatDuration(held) })}\n`)
  return held
}
