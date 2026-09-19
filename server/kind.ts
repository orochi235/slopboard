import { extname } from 'node:path'

/**
 * What the wall does with a file, or null for one it does not hold.
 *
 * A page and a video are both images to everything downstream of ingest —
 * each is given a poster once and the poster goes through the same pipeline —
 * so this is the only place the three are ever told apart on the daemon side.
 */
export type Kind = 'image' | 'page' | 'video'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff'])
const PAGE_EXT = new Set(['.html', '.htm'])
/** The containers Chrome plays. ffmpeg would poster a `.mkv` happily and the
 *  lightbox would then show a dead player, so the wall does not hold one. */
const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov', '.webm'])

/** Every extension the wall holds. `bin/slop` refuses the rest at the send,
 *  and `kind.test.ts` holds the two lists to each other. */
export const HELD_EXT: readonly string[] = [...IMAGE_EXT, ...PAGE_EXT, ...VIDEO_EXT]

export function kindOf(path: string): Kind | null {
  const ext = extname(path).toLowerCase()
  if (IMAGE_EXT.has(ext)) return 'image'
  if (PAGE_EXT.has(ext)) return 'page'
  if (VIDEO_EXT.has(ext)) return 'video'
  return null
}
