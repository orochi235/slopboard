import { readFile, rename } from 'node:fs/promises'
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
  for (const key of ['caption', 'zone', 'repo', 'sha'] as const) {
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

/** Follows its image into the trash. Left behind it would be an orphan the
 *  wall never looks at again. */
export async function trashStamp(imagePath: string, dest: string): Promise<void> {
  await rename(sidecarFor(imagePath), sidecarFor(dest)).catch(() => {})
}
