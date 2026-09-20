import { rename, writeFile } from 'node:fs/promises'

/**
 * Replacing a small state file without ever leaving a half-written one.
 *
 * Two things go wrong with a bare `writeFile`, and a slider drag does both at
 * once because it posts several times a second:
 *
 * - **Overlap.** Two calls to the same path interleave, and where the earlier
 *   value was longer its tail survives past the later one's end. The file then
 *   holds valid JSON followed by garbage.
 * - **Torn reads.** A reader that arrives mid-write sees a truncated file.
 *
 * So: one writer at a time per path, and the write itself lands on a temporary
 * beside the target and is moved onto it, which is atomic within a filesystem.
 * `store.ts` already does the second half for answers; this is both halves, for
 * anything that keeps state.
 */

/** The write in flight for each path, so the next one waits rather than races. */
const queue = new Map<string, Promise<void>>()

export async function save(file: string, text: string): Promise<void> {
  const next = (queue.get(file) ?? Promise.resolve()).then(async () => {
    const tmp = `${file}.tmp`
    await writeFile(tmp, text)
    await rename(tmp, file)
  })
  // Held whether it settles or throws, or one failed write would strand every
  // later write behind a rejected promise.
  queue.set(
    file,
    next.catch(() => {}),
  )
  await next
}
