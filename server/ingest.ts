import chokidar from 'chokidar'
import sharp from 'sharp'
import { mkdir, stat, rename, utimes, writeFile } from 'node:fs/promises'
import { basename, dirname, join, extname } from 'node:path'
import { config } from './config.ts'
import * as store from './store.ts'
import type { WallItem } from '@shared/protocol.ts'
import { ttlFromName } from './ttlSuffix.ts'
import { captionFor } from './captionName.ts'
import { idFor } from './itemId.ts'
import { readStamp } from './sidecar.ts'
import { parseAttention } from '@shared/attention.ts'
import { buildXmp, type Stamp } from './xmp.ts'
import { createLimiter } from './limit.ts'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff'])

/**
 * The stamp into the file the wall hands out, which is the original — `/orig`
 * serves it, and expiry renames it to `<id>-<zone>` with no extension, so the
 * only provenance that survives either trip is the kind carried inside.
 *
 * PNG only, because writing metadata means re-encoding: lossless for a PNG,
 * and a silent quality loss for anything else. A JPEG keeps its bytes and
 * goes unstamped rather than being quietly degraded.
 */
export async function stampOriginal(sourcePath: string, xmp: string): Promise<void> {
  if (extname(sourcePath).toLowerCase() !== '.png') return
  try {
    const { atime, mtime } = await stat(sourcePath)
    // Through a buffer: sharp cannot read and write the same path.
    await writeFile(sourcePath, await sharp(sourcePath).withXmp(xmp).png().toBuffer())
    // `adopt` reads mtime so that a restart cannot resurrect the wall, so a
    // stamp that bumps it re-ages every item the daemon re-adopts.
    await utimes(sourcePath, atime, mtime)
  } catch (err) {
    console.warn(`[ingest] unstamped ${basename(sourcePath)}: ${(err as Error).message}`)
  }
}

async function ingest(sourcePath: string, bornAt: number): Promise<WallItem | null> {
  if (!IMAGE_EXT.has(extname(sourcePath).toLowerCase())) return null
  if (store.has(sourcePath)) return null

  const id = idFor(sourcePath)
  const cachePath = join(config.cache, `${id}.webp`)
  await mkdir(config.cache, { recursive: true })

  const zone = basename(dirname(sourcePath))
  const sidecar = await readStamp(sourcePath)
  const caption = captionFor(basename(sourcePath), sidecar)
  const xmp = buildXmp({ ...sidecar, zone, caption } satisfies Stamp)

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
      // Written rather than kept: the stamp carries what the source file could
      // not know, starting with the zone it landed in.
      .withXmp(xmp)
      .webp({ quality: 82 })
      .toFile(cachePath)
  } catch (err) {
    console.warn(`[ingest] skipped ${basename(sourcePath)}: ${(err as Error).message}`)
    return null
  }

  await stampOriginal(sourcePath, xmp)

  const ttlMs = ttlFromName(basename(sourcePath))
  const attention = sidecar?.attention ? parseAttention(sidecar.attention) : null
  if (sidecar?.attention && !attention) {
    console.warn(`[ingest] unreadable attention "${sidecar.attention}" on ${basename(sourcePath)}`)
  }
  const item: WallItem = {
    id,
    ...(ttlMs === null ? {} : { ttlMs }),
    ...(attention === null ? {} : { attention }),
    // A note without a flag has nothing to hang on, so it is dropped with it.
    ...(attention !== null && sidecar?.note ? { note: sidecar.note } : {}),
    url: `/img/${id}`,
    origUrl: `/orig/${id}`,
    zone,
    name: caption,
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

  // Capped because ingest is the daemon's only heavy work: a decode, a resize,
  // a webp encode and a full-resolution re-encode per file. Uncapped, a restart
  // with a full inbox starts all of them at once.
  const gate = createLimiter(config.ingestAtOnce)

  watcher.on('add', (path) => {
    if (dirname(path) === config.inbox) return // zone dirs only
    // Both read at arrival rather than when the turn comes. A file waiting
    // behind others must not be dated when it finally runs, and one that was
    // already on disk at startup must not be re-read as a live arrival because
    // `ready` flipped while it queued — which would date it now and resurrect
    // the wall, the exact thing `adopt` exists to prevent.
    const at = Date.now()
    const adopting = !ready
    void gate(async () => {
      const item = adopting ? await adopt(path) : await ingest(path, at)
      if (item) onArrive(item)
    })
  })
  watcher.on('ready', () => {
    ready = true
    console.log(`[watch] ${config.inbox} (ttl ${config.ttlMs / 1000}s)`)
  })
  return watcher
}
