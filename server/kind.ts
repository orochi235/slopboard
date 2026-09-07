import { extname } from 'node:path'

/**
 * What the wall does with a file, or null for one it does not hold.
 *
 * A page is an image to everything downstream of ingest — it is shot once and
 * the shot goes through the same pipeline — so this is the only place the two
 * are ever told apart on the daemon side.
 */
export type Kind = 'image' | 'page'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff'])
const PAGE_EXT = new Set(['.html', '.htm'])

export function kindOf(path: string): Kind | null {
  const ext = extname(path).toLowerCase()
  if (IMAGE_EXT.has(ext)) return 'image'
  if (PAGE_EXT.has(ext)) return 'page'
  return null
}
