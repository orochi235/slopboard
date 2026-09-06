import { createHash } from 'node:crypto'

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
