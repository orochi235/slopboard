import { parseDuration } from '@shared/duration.ts'

/**
 * A per-item TTL, written into the filename as its own dot-segment:
 * `<name>.ttl<duration>.<ext>`. The name is the whole protocol — a suffix
 * survives a daemon restart, because `adopt` re-reads it off disk.
 */
export function ttlFromName(name: string): number | null {
  const match = /\.ttl([^.]+)\.[^.]+$/.exec(name)
  return match ? parseDuration(match[1]!) : null
}
