import { spawn } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from './config.ts'

export type ShotOpts = {
  browser: string
  pagePath: string
  outPath: string
  profileDir: string
  width: number
  height: number
}

/** Pure, so the flags are readable and testable without launching anything. */
export function shotArgv(o: ShotOpts): [string, ...string[]] {
  return [
    o.browser,
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    // A page may animate forever; this is the paint it is judged on.
    '--virtual-time-budget=2000',
    `--window-size=${o.width},${o.height}`,
    `--screenshot=${o.outPath}`,
    // Its own profile per shot: a shared one is locked by the first Chrome to
    // take it, and the second silently produces nothing.
    `--user-data-dir=${o.profileDir}`,
    pathToFileURL(o.pagePath).href,
  ]
}

/** The file's size, or null while it does not exist yet. */
async function sizeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size
  } catch {
    return null
  }
}

/**
 * A PNG of the page, or false.
 *
 * Chrome writes the shot and then keeps running — measured on 152.0.7977.76,
 * in both headless modes, with and without a virtual time budget. So this
 * polls for the file and kills the process rather than awaiting its exit. An
 * await here would hold one of the three ingest slots forever.
 */
export async function shootPage(pagePath: string, outPath: string): Promise<boolean> {
  const profileDir = await mkdtemp(join(tmpdir(), 'slop-shot-'))
  const [cmd, ...args] = shotArgv({
    browser: config.shotBrowser,
    pagePath,
    outPath,
    profileDir,
    width: config.shotWidth,
    height: config.shotHeight,
  })

  const child = spawn(cmd, args, { stdio: 'ignore' })
  const deadline = Date.now() + config.shotTimeoutMs
  let lastSize = -1
  let done = false

  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150))
      const size = await sizeOf(outPath)
      if (size === null) continue
      // Two readings the same means the write finished. One is not enough:
      // Chrome creates the file before it has written the pixels.
      if (size > 0 && size === lastSize) {
        done = true
        break
      }
      lastSize = size
    }
  } finally {
    child.kill('SIGKILL')
    await rm(profileDir, { recursive: true, force: true }).catch(() => {})
  }

  if (!done) console.warn(`[shoot] no picture from ${pagePath} in ${config.shotTimeoutMs}ms`)
  return done
}
