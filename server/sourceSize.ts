/**
 * How big an artifact actually is, as anyone looking at it would measure it.
 *
 * Two things make this less obvious than reading `width` and `height`. Ingest
 * resizes to a cache thumbnail, so sharp's `OutputInfo` describes the webp and
 * not the picture the wall hands out from `/orig`. And EXIF orientations 5-8
 * carry a quarter turn, which `.rotate()` applies but `metadata()` does not, so
 * the stored axes come back swapped for anything shot in portrait.
 */
export type SourceMeta = { width?: number; height?: number; orientation?: number }

export function orientedSize(meta: SourceMeta): { w: number; h: number } | null {
  const { width, height } = meta
  if (!width || !height) return null
  const turned = (meta.orientation ?? 1) >= 5
  return turned ? { w: height, h: width } : { w: width, h: height }
}
