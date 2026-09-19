import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import { promisify } from 'node:util'
import { config } from './config.ts'

const run = promisify(execFile)

/**
 * The seconds ffprobe reports for a container, as ms.
 *
 * Null for a container that declares none — some `.webm` do not — which is an
 * ordinary outcome and not an error: the badge reads a bare `▶` and nothing
 * else changes.
 */
export function durationFrom(json: string): number | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const raw = (parsed as { format?: { duration?: unknown } })?.format?.duration
  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.round(seconds * 1000)
}

/** Only ever asked for the duration. Width and height come from the poster,
 *  because ffprobe reports a stream's size before its display matrix is
 *  applied and a phone's `.mov` carries one. */
export async function durationOf(path: string): Promise<number | null> {
  try {
    const { stdout } = await run(
      config.ffprobe,
      ['-v', 'error', '-show_format', '-of', 'json', path],
      { timeout: config.posterTimeoutMs },
    )
    return durationFrom(stdout)
  } catch (err) {
    console.warn(`[probe] no runtime for ${basename(path)}: ${(err as Error).message}`)
    return null
  }
}
