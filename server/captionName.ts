/**
 * The caption a file carries in its own name: the basename with the TTL
 * segment and the extension removed. Same protocol as `ttlFromName`, read the
 * other way round, so `render.ttl5m.png` captions as `render`.
 */
export function captionFromName(name: string): string {
  const noExt = name.replace(/\.[^.]+$/, '')
  return noExt.replace(/\.ttl[^.]+$/, '')
}
