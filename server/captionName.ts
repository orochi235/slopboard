import type { Stamp } from './xmp.ts'

/**
 * The caption a file carries in its own name: the basename with the TTL
 * segment and the extension removed. Same protocol as `ttlFromName`, read the
 * other way round, so `render.ttl5m.png` captions as `render`.
 */
export function captionFromName(name: string): string {
  const noExt = name.replace(/\.[^.]+$/, '')
  return noExt.replace(/\.ttl[^.]+$/, '')
}

/**
 * The caption an item shows, empty for one that has none.
 *
 * A sidecar answers outright: a file from `bin/transom` is named with a UUID, so
 * falling back to its name would caption a piped render with a hex string.
 * The name is read only where there is no sidecar, which is the hand-dropped
 * file whose name is the only thing it says.
 */
export function captionFor(name: string, sidecar: Stamp | null): string {
  if (sidecar) return sidecar.caption ?? ''
  return captionFromName(name)
}
