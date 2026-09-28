import { createHash } from 'node:crypto'
import { extname } from 'node:path'

/**
 * An artifact's id, derived from where it lives rather than minted fresh.
 *
 * A random id per ingest looks harmless until the daemon restarts: `adopt`
 * re-ingests every file, every artifact gets a new id, and every `/img/<id>`
 * a client is already holding 404s at once. The wall goes blank while its
 * item count stays right, and only a reload fixes it.
 *
 * The source path is the one thing about an artifact that survives a restart,
 * so it is the identity. Same file, same id, however many times the daemon
 * has come and gone.
 */
export function idFor(sourcePath: string): string {
  return createHash('sha1').update(sourcePath).digest('hex').slice(0, 32)
}

/**
 * A group's card id, derived from its zone and the name `--group` gave it.
 *
 * Derived rather than minted so that appending a take is a lookup: two takes
 * landing in the same tick resolve to the same card, and a daemon restart
 * re-adopts every take of a group into the one card it was in before.
 */
export function groupIdFor(zone: string, group: string): string {
  // `run:` is the v0.2.0 name, kept so a group card keeps its id.
  return createHash('sha1').update(`run:${zone}:${group}`).digest('hex').slice(0, 32)
}

/**
 * Where the original is served, carrying the source's extension so that a
 * save, a new tab or a hand-off to another app gets a name it can open.
 */
export function origUrlFor(id: string, sourcePath: string): string {
  return `/orig/${id}${extname(sourcePath).toLowerCase()}`
}

/** The id an `/orig/` path segment names, with or without the extension. */
export function idFromOrig(segment: string): string {
  return segment.replace(/\.[a-z0-9]+$/i, '')
}
