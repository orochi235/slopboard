import chokidar from 'chokidar'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { mkdir, stat, rename } from 'node:fs/promises'
import { basename, dirname, join, extname } from 'node:path'
import { config } from './config.ts'
import * as store from './store.ts'
import type { WallItem } from '@shared/protocol.ts'
import { ttlFromName } from './ttlSuffix.ts'
import { captionFromName } from './captionName.ts'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff'])

async function ingest(sourcePath: string, bornAt: number): Promise<WallItem | null> {
  if (!IMAGE_EXT.has(extname(sourcePath).toLowerCase())) return null
  if (store.has(sourcePath)) return null

  const id = randomUUID()
  const cachePath = join(config.cache, `${id}.webp`)
  await mkdir(config.cache, { recursive: true })

  let info: sharp.OutputInfo
  try {
    info = await sharp(sourcePath)
      .rotate()
      .resize({
        width: config.maxEdge,
        height: config.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(cachePath)
  } catch (err) {
    console.warn(`[ingest] skipped ${basename(sourcePath)}: ${(err as Error).message}`)
    return null
  }

  const ttlMs = ttlFromName(basename(sourcePath))
  const item: WallItem = {
    id,
    ...(ttlMs === null ? {} : { ttlMs }),
    url: `/img/${id}`,
    origUrl: `/orig/${id}`,
    zone: basename(dirname(sourcePath)),
    name: captionFromName(basename(sourcePath)),
    bornAt,
    w: info.width,
    h: info.height,
  }
  store.add({ item, sourcePath, cachePath })
  return item
}

/**
 * Files present at startup are adopted at their mtime, not "now" — a daemon
 * restart must not resurrect the wall or reset anything's decay.
 */
async function adopt(sourcePath: string): Promise<WallItem | null> {
  const { mtimeMs } = await stat(sourcePath)
  if (Date.now() - mtimeMs > (ttlFromName(basename(sourcePath)) ?? config.ttlMs)) {
    await mkdir(config.trash, { recursive: true })
    await rename(sourcePath, join(config.trash, basename(sourcePath))).catch(() => {})
    return null
  }
  return ingest(sourcePath, mtimeMs)
}

export function watchInbox(onArrive: (item: WallItem) => void) {
  let ready = false
  const watcher = chokidar.watch(config.inbox, {
    depth: 1,
    ignoreInitial: false,
    // chokidar fires `add` on creation, not completion: without this, a
    // streaming write (`gen | slop renders`) hands sharp a truncated file.
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 50 },
  })

  watcher.on('add', async (path) => {
    if (dirname(path) === config.inbox) return // zone dirs only
    const item = ready ? await ingest(path, Date.now()) : await adopt(path)
    if (item) onArrive(item)
  })
  watcher.on('ready', () => {
    ready = true
    console.log(`[watch] ${config.inbox} (ttl ${config.ttlMs / 1000}s)`)
  })
  return watcher
}
