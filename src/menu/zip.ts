import { zipBytes } from '@shared/zip.ts'
import type { ZipEntry } from '@shared/zipPlan.ts'

/** Hands the browser something to save. The daemon's zip routes name the file
 *  in `Content-Disposition`, so a navigation is the whole download. */
export function download(url: string, as?: string) {
  const a = document.createElement('a')
  a.href = url
  if (as !== undefined) a.download = as
  a.rel = 'noopener'
  a.click()
}

/**
 * The same archive, built in the page.
 *
 * For the demo wall, which has no daemon to stream one: it fetches what it is
 * already showing and zips it with the writer the daemon uses, so the download
 * a visitor gets is the download the real wall gives.
 */
export async function zipHere(
  entries: readonly ZipEntry[],
  urlOf: (id: string) => string | undefined,
  filename: string,
): Promise<void> {
  const files = async function* () {
    for (const entry of entries) {
      const url = urlOf(entry.id)
      if (!url) continue
      const res = await fetch(url).catch(() => null)
      if (!res?.ok) continue
      yield { name: entry.name, bytes: new Uint8Array(await res.arrayBuffer()) }
    }
  }
  const blob = new Blob([await zipBytes(files())], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  download(url, filename)
  // Freeing it while the save is still starting cancels the save, and a minute
  // is longer than any browser takes to pick the bytes up.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
