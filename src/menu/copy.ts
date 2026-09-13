import type { WallItem } from '@shared/protocol.ts'

const ok = (r: Response): Response => {
  if (!r.ok) throw new Error(`${r.status} ${r.url}`)
  return r
}

async function pngOf(item: WallItem): Promise<Blob> {
  const original = await fetch(item.origUrl).then((r) => ok(r).blob())
  if (original.type === 'image/png') return original
  // A TIFF decodes in no browser but Safari. The cache copy always does, at
  // the wall's capped size, which beats copying nothing.
  const bitmap = await createImageBitmap(original).catch(async () =>
    createImageBitmap(await fetch(item.url).then((r) => ok(r).blob())),
  )
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/png' })
}

/**
 * What "Copy artifact" puts on the clipboard, by type: a page as its HTML, a
 * picture as a PNG — the only image type `clipboard.write` accepts, so any
 * other is re-encoded. An animation copies its first frame.
 */
export function payloadOf(item: WallItem): Record<string, Promise<Blob>> {
  if (item.kind === 'page') {
    const source = fetch(item.origUrl).then((r) => ok(r).text())
    return {
      'text/html': source.then((t) => new Blob([t], { type: 'text/html' })),
      'text/plain': source.then((t) => new Blob([t], { type: 'text/plain' })),
    }
  }
  return { 'image/png': pngOf(item) }
}

/** The blobs go in as promises: the write has to start inside the click that
 *  asked for it, and the fetch finishes after that gesture has ended. */
export function copyArtifact(item: WallItem): Promise<void> {
  if (!navigator.clipboard?.write) return Promise.reject(new Error('no clipboard here'))
  return navigator.clipboard.write([new ClipboardItem(payloadOf(item))])
}
