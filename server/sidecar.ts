import { readFile, rename, writeFile } from 'node:fs/promises'
import type { Stamp } from './xmp.ts'

/**
 * `<image>.slop.json`, written by `bin/slop` beside the image it describes.
 *
 * A sidecar rather than the filename, which is where the TTL rides: a caption
 * holds spaces and slashes, and the name is not durable anyway — expiry
 * renames a file to `<id>-<zone>`, dropping even its extension. `bin/slop`
 * writes the sidecar *before* the image, so the image's arrival — which is
 * what the watcher triggers on — proves the sidecar is already complete.
 */
export const sidecarFor = (imagePath: string) => `${imagePath}.slop.json`

/** Only the fields the wall knows, only where they are strings. A blob from
 *  an older or hand-edited sidecar loses what does not fit rather than
 *  reaching the wall as junk. */
export function parseStamp(blob: unknown): Stamp {
  if (blob === null || typeof blob !== 'object' || Array.isArray(blob)) return {}
  const held = blob as Record<string, unknown>
  const out: Stamp = {}
  for (const key of ['caption', 'zone', 'repo', 'sha', 'attention', 'note', 'kept', 'sandbox'] as const) {
    const value = held[key]
    if (typeof value === 'string' && value !== '') out[key] = value
  }
  return out
}

/**
 * The stamp beside an image, or null where there is no sidecar at all — which
 * is the common case, not an error: most files are dropped in by hand. The
 * distinction carries: a sidecar with no caption means the CLI had nothing to
 * say, and a UUID filename must not be read as one.
 */
export async function readStamp(imagePath: string): Promise<Stamp | null> {
  try {
    return parseStamp(JSON.parse(await readFile(sidecarFor(imagePath), 'utf8')))
  } catch {
    return null
  }
}

/**
 * Drops the attention token from an image's sidecar, so a dismissal survives a
 * daemon restart — `adopt` re-reads the sidecar off disk, and a flag left there
 * would come back the moment the daemon bounced.
 *
 * A missing sidecar is not an error: an item flagged by hand-editing has
 * nothing to clear, and the in-memory store has already forgotten the flag.
 */
export async function clearAttention(imagePath: string): Promise<void> {
  const path = sidecarFor(imagePath)
  try {
    const blob = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
    if (!('attention' in blob)) return
    delete blob.attention
    await writeFile(path, `${JSON.stringify(blob)}\n`)
  } catch {
    // Nothing to clear, or a sidecar this build cannot read. Either way the
    // dismissal already happened in the store, which is what the wall shows.
  }
}

/**
 * Writes the rescue into the sidecar, or takes it back out. Nothing else
 * survives a daemon restart: `adopt` re-reads the sidecar off disk, so a keep
 * held only in memory would let a rescued file expire on the next bounce.
 *
 * Written as an ISO string because the sidecar is a file people read and
 * hand-edit; `readKept` takes it back to a number.
 */
export async function setKept(imagePath: string, keptAt: number | null): Promise<void> {
  const path = sidecarFor(imagePath)
  let blob: Record<string, unknown> = {}
  try {
    blob = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    // Most files arrive without one. A rescue is the wall's own record, so it
    // writes the sidecar the CLI never did rather than dropping the keep.
  }
  if (keptAt === null) delete blob.kept
  else blob.kept = new Date(keptAt).toISOString()
  await writeFile(path, `${JSON.stringify(blob)}\n`)
}

/** When an image was rescued, or null. Unparseable is null: a hand-edited
 *  date that means nothing must not freeze a file on the wall forever. */
export function keptFrom(stamp: Stamp | null): number | null {
  if (!stamp?.kept) return null
  const at = Date.parse(stamp.kept)
  return Number.isNaN(at) ? null : at
}

/** Follows its image into the trash. Left behind it would be an orphan the
 *  wall never looks at again. */
export async function trashStamp(imagePath: string, dest: string): Promise<void> {
  await rename(sidecarFor(imagePath), sidecarFor(dest)).catch(() => {})
}
