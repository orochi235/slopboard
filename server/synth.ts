import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.ts'

/**
 * Artifacts the wall makes for itself, so a question, a run or an answered card
 * can be looked at without an agent to produce one.
 *
 * These are **real sends**: a file and a sidecar in the inbox, ingested by the
 * ordinary watcher, answered through the ordinary route. A fabrication that
 * only existed in the browser could not be answered at all — its id reaches no
 * daemon — and a carousel nobody can click is not the thing being evaluated.
 *
 * They land in the `debug` zone on a short TTL, so a session of them clears
 * itself rather than sitting on the wall for a day.
 */

/** Long enough to look at, short enough that nobody has to clean up. */
const SYNTH_TTL = '20m'
const ZONE = 'debug'
/** A slip must not write hundreds of files into the inbox. */
export const MAX_SYNTH_TAKES = 12

/**
 * What a synthetic question offers to answer with.
 *
 * A fixture, not a default the wall is starting to own: the protocol still takes
 * whatever choices a sender names, and the day a second consumer wants these
 * exact five is the day they earn a home in `shared/`.
 */
const VERDICTS = ['no change', 'worse', 'neutral', 'better', 'fixed']

/**
 * A labeled card, the shape `server/sim.ts` has always drawn.
 *
 * The type size is fitted to the label rather than fixed, so `take 3/12` stays
 * inside the card while a bare `7` still fills it the way the simulator's
 * always have — a cap of the short edge, a fit to 70% of the long one.
 */
export function card(label: string, hue: number, w: number, h: number): Promise<Buffer> {
  const size = Math.round(
    Math.min(Math.min(w, h) * 0.4, (w * 0.7) / Math.max(1, label.length * 0.6)),
  )
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 70% 55%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360} 65% 28%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="Helvetica, sans-serif" font-size="${size}"
      fill="rgba(255,255,255,.85)">${label}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

type Sidecar = Record<string, unknown>

/**
 * Writes one artifact: the sidecar first, then the image, because the watcher
 * triggers on the image and the other order is a race it loses. Mirrors what
 * `bin/slop` writes.
 *
 * The sidecar is built from the destination rather than passed in, since an
 * offered app points at the artifact and the artifact's name is a UUID picked
 * here.
 */
async function land(caption: string, blob: Buffer, sidecar: (dest: string) => Sidecar) {
  const dir = join(config.inbox, ZONE)
  await mkdir(dir, { recursive: true })
  const dest = join(dir, `${randomUUID()}.ttl${SYNTH_TTL}.png`)
  await writeFile(`${dest}.slop.json`, `${JSON.stringify({ ...sidecar(dest), caption })}\n`)
  await writeFile(dest, blob)
  return dest
}

const QUESTION = 'how does this read?'

/** A question with chips and a comment box, and a row of ways out under it. The
 *  app is pointed at the artifact itself: the one file that certainly exists,
 *  and the one the OS default would have opened anyway. */
const asked = (dest: string): Sidecar => ({
  question: QUESTION,
  choices: VERDICTS,
  why: 'anything to add?',
  apps: [{ name: 'Preview', path: dest }],
  links: [{ label: 'slopboard on github', url: 'https://github.com/orochi235/slopboard' }],
})

/** A run: one card, `takes` pictures, a question on each. */
export async function synthRun(takes: number, label = 'synthetic run'): Promise<string[]> {
  const run = `debug-${randomUUID().slice(0, 8)}`
  const hue = Math.floor(Math.random() * 360)
  const out: string[] = []
  for (let n = 1; n <= takes; n++) {
    const blob = await card(`take ${n}/${takes}`, (hue + n * 37) % 360, 720, 480)
    out.push(
      await land(`take ${n}`, blob, (dest) => ({
        run,
        runLabel: label,
        of: takes,
        ...asked(dest),
      })),
    )
  }
  return out
}

/** One card with a question on it: the shape a run is not. */
export async function synthAsk(): Promise<string> {
  const blob = await card('asking', Math.floor(Math.random() * 360), 720, 480)
  return land('synthetic question', blob, asked)
}

/**
 * A card whose question has already been answered — the one state clicking
 * cannot reach, since answering is the thing being looked at.
 */
export async function synthAnswered(): Promise<string> {
  const blob = await card('answered', Math.floor(Math.random() * 360), 720, 480)
  return land('synthetic reply', blob, (dest) => ({
    ...asked(dest),
    closed: 'answered',
    choice: 'better',
    reply: 'the corners read now',
    closedAt: new Date().toISOString(),
  }))
}
