import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { promisify } from 'node:util'
import { config } from './config.ts'
import type { Kind } from './kind.ts'
import { shootPage } from './shoot.ts'

const run = promisify(execFile)

/**
 * Pure, so the seek argument is readable and testable without spawning
 * anything. `-ss` goes before `-i`: that is an input seek and costs a container
 * seek, where the same flag after `-i` decodes everything it skips — on a long
 * video, the difference between instant and a minute holding an ingest slot.
 */
export function frameArgv(source: string, out: string, atMs: number): string[] {
  return [
    '-v', 'error',
    '-ss', (atMs / 1000).toFixed(3),
    '-i', source,
    '-frames:v', '1',
    '-y', out,
  ]
}

/** Whether the file exists with bytes in it. ffmpeg can exit 0 having written
 *  an empty file when the seek lands past the end. */
async function wrote(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

/**
 * A PNG of one frame, or false.
 *
 * Seeked to `config.posterAtMs` and retried at 0 when that lands past the end,
 * which is the case for a video shorter than the offset.
 */
export async function frameOf(source: string, out: string): Promise<boolean> {
  for (const atMs of [config.posterAtMs, 0]) {
    try {
      await run(config.ffmpeg, frameArgv(source, out, atMs), {
        timeout: config.posterTimeoutMs,
      })
    } catch (err) {
      console.warn(`[poster] ffmpeg on ${basename(source)}: ${(err as Error).message}`)
    }
    if (await wrote(out)) return true
    if (atMs === 0) break
  }
  console.warn(`[poster] no frame from ${basename(source)}`)
  return false
}

/**
 * The pixels to hand the picture pipeline, or null for an artifact the wall
 * cannot take.
 *
 * A picture is its own poster. A page and a video are not: each is given one
 * here, and everything downstream of ingest is spared knowing either exists.
 * `out` is written only for those two, which is how the caller knows what to
 * clean up — it is what came back, when what came back is not the source.
 *
 * The runners are injected so the dispatch can be tested without a browser or
 * a decoder.
 */
export async function posterFor(
  kind: Kind,
  source: string,
  out: string,
  runners: { shoot?: typeof shootPage; frame?: typeof frameOf } = {},
): Promise<string | null> {
  if (kind === 'image') return source
  const make = kind === 'page' ? (runners.shoot ?? shootPage) : (runners.frame ?? frameOf)
  return (await make(source, out)) ? out : null
}
