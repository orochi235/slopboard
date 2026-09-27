import { readFile, stat } from 'node:fs/promises'
import type { Response } from 'express'
import { zipStream } from '@shared/zip.ts'
import type { ZipEntry } from '@shared/zipPlan.ts'

/** How an id becomes bytes. Injected so the streaming can be tested without a
 *  store or a disk. */
export type Reader = (id: string) => Promise<{ bytes: Uint8Array; at?: Date } | null>

export const readOriginal =
  (resolve: (id: string) => string | undefined): Reader =>
  async (id) => {
    const path = resolve(id)
    if (!path) return null
    try {
      const [bytes, info] = await Promise.all([readFile(path), stat(path)])
      return { bytes: new Uint8Array(bytes), at: info.mtime }
    } catch {
      // A file the wall still lists and the disk no longer holds. The rest of
      // the stack is worth more than the failure.
      return null
    }
  }

/** A filename a `Content-Disposition` header can carry unquoted trouble-free. */
const headerSafe = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-')

/**
 * Stream a stack to the browser as a zip.
 *
 * The response starts before the first file is read, so a failure partway
 * through cannot become a 500 — it drops that file and keeps going, and an id
 * whose file has gone simply is not in the archive.
 */
export async function serveZip(
  res: Response,
  entries: readonly ZipEntry[],
  filename: string,
  read: Reader,
): Promise<void> {
  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', `attachment; filename="${headerSafe(filename)}"`)
  res.set('Cache-Control', 'no-store')
  const sources = async function* () {
    for (const entry of entries) {
      const file = await read(entry.id)
      if (file) yield { name: entry.name, bytes: file.bytes, at: file.at }
    }
  }
  for await (const chunk of zipStream(sources())) {
    if (res.writableEnded) return
    // Backpressure: a zone of big renders would otherwise sit in the socket's
    // buffer all at once, which is the memory the streaming exists to avoid.
    if (!res.write(chunk)) await new Promise((go) => res.once('drain', go))
  }
  res.end()
}
