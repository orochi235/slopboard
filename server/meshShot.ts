import sharp from 'sharp'
import { basename } from 'node:path'
import { config } from './config.ts'
import { meshViewUrl } from './meshview.ts'
import { shootUrl } from './shoot.ts'

/**
 * Whether anything drew. A mesh the viewer could not load still leaves Chrome
 * writing a perfectly good transparent PNG, and the card would be an empty
 * rectangle nobody can explain — so an untouched alpha channel is read as a
 * failed render rather than as a picture.
 */
export async function hasInk(path: string): Promise<boolean> {
  try {
    const { channels } = await sharp(path).stats()
    const alpha = channels[3]
    return alpha ? alpha.max > 0 : true
  } catch {
    return false
  }
}

/**
 * A PNG of the mesh, or false.
 *
 * Rendered by the same headless Chrome that shoots a page, pointed at the
 * daemon's own viewer: three is already a dependency and Chrome draws WebGL
 * through SwiftShader with no GPU, where a node GL binding would be a native
 * module built per platform.
 */
export async function shootMesh(source: string, out: string): Promise<boolean> {
  const drawn = await shootUrl(meshViewUrl(source), out, {
    width: config.meshShotEdge,
    height: config.meshShotEdge,
    transparent: true,
    webgl: true,
    timeoutMs: config.meshShotTimeoutMs,
  })
  if (!drawn) return false
  if (await hasInk(out)) return true
  console.warn(`[mesh] nothing rendered from ${basename(source)}`)
  return false
}
