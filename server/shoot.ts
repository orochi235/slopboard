import { spawn } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from './config.ts'

export type ShotOpts = {
  browser: string
  /** Already a URL: a page is shot from `file://`, a mesh from the daemon's
   *  own viewer over http, and Chrome is handed whichever verbatim. */
  url: string
  outPath: string
  profileDir: string
  width: number
  height: number
  /** Shoot onto nothing rather than onto white, for a subject that is an
   *  object rather than a document. */
  transparent?: boolean
  /** Whether the page draws with WebGL. `--disable-gpu` is the right default
   *  for a document and leaves a GL page blank — measured: the canvas is
   *  there, the context is not — so a page that needs one asks for software
   *  rendering instead. */
  webgl?: boolean
}

/** Pure, so the flags are readable and testable without launching anything. */
export function shotArgv(o: ShotOpts): [string, ...string[]] {
  return [
    o.browser,
    '--headless=new',
    ...(o.webgl
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
      : ['--disable-gpu']),
    '--hide-scrollbars',
    // A page may animate forever; this is the paint it is judged on.
    '--virtual-time-budget=2000',
    `--window-size=${o.width},${o.height}`,
    `--screenshot=${o.outPath}`,
    // Its own profile per shot: a shared one is locked by the first Chrome to
    // take it, and the second silently produces nothing.
    `--user-data-dir=${o.profileDir}`,
    ...(o.transparent ? ['--default-background-color=00000000'] : []),
    o.url,
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
 * A PNG of whatever the URL draws, or false.
 *
 * Chrome writes the shot and then keeps running — measured on 152.0.7977.76,
 * in both headless modes, with and without a virtual time budget. So this
 * polls for the file and kills the process rather than awaiting its exit. An
 * await here would hold one of the three ingest slots forever.
 */
export async function shootUrl(
  url: string,
  outPath: string,
  frame: {
    width: number
    height: number
    transparent?: boolean
    webgl?: boolean
    /** How long Chrome gets to paint. Its own argument because a software GL
     *  render is slower than a document, and three of them run at once. */
    timeoutMs?: number
  } = { width: config.shotWidth, height: config.shotHeight },
): Promise<boolean> {
  // Any earlier attempt's file goes first: the shot is detected by watching
  // the path appear and settle, so one left behind is read as this shot's and
  // comes back instantly with the last run's pixels.
  await rm(outPath, { force: true }).catch(() => {})
  const profileDir = await mkdtemp(join(tmpdir(), 'slop-shot-'))
  const [cmd, ...args] = shotArgv({
    browser: config.shotBrowser,
    url,
    outPath,
    profileDir,
    ...frame,
  })

  const child = spawn(cmd, args, { stdio: 'ignore' })
  const deadline = Date.now() + (frame.timeoutMs ?? config.shotTimeoutMs)
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

  if (!done)
    console.warn(
      `[shoot] no picture from ${url} in ${frame.timeoutMs ?? config.shotTimeoutMs}ms`,
    )
  return done
}

/** The page case: the file the wall was sent, drawn at the page viewport. */
export const shootPage = (pagePath: string, outPath: string): Promise<boolean> =>
  shootUrl(pathToFileURL(pagePath).href, outPath)
