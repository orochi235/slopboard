import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseDuration } from '../shared/duration.ts'

const root = process.env.SLOP_ROOT ?? join(homedir(), 'slop')

export const config = {
  root,
  inbox: join(root, 'inbox'),
  cache: join(root, '.cache'),
  trash: join(root, 'trash'),
  /** Where a question's answer lands, named for the file `bin/slop` sent.
   *  Not beside the image: expiry renames that into the trash. */
  answers: join(root, 'answers'),
  port: Number(process.env.SLOP_PORT ?? 8787),
  ttlMs: parseDuration(process.env.SLOP_TTL ?? '8h') ?? 28_800_000,
  trashMs: 24 * 60 * 60 * 1000,
  maxEdge: 1024,
  /** Files ingested at once. Each one decodes, resizes, encodes a webp and
   *  re-encodes a full-resolution PNG, so this is the daemon's memory ceiling
   *  in practice. Overridable so the ceiling can be measured rather than
   *  argued about. */
  ingestAtOnce: Number(process.env.SLOP_INGEST_AT_ONCE ?? 3),
  /** How often the inbox is swept for artifacts the store never took in. The
   *  watch is an optimization over this, not the other way round. */
  sweepMs: Number(process.env.SLOP_SWEEP_MS ?? 30_000),
  /** What an arrival at a level that asks for noise plays. */
  alertSound: process.env.SLOP_ALERT_SOUND ?? '/System/Library/Sounds/Glass.aiff',
  /** How the daemon opens the wall when something asks to be seen and nothing
   *  is connected. Its own profile, so the wall is not in the main browser's
   *  process pool and cannot be tab-discarded. */
  wallBrowser: process.env.SLOP_WALL_BROWSER ?? 'Google Chrome',
  wallUrl: process.env.SLOP_WALL_URL ?? 'http://localhost:5183',
  wallProfile: process.env.SLOP_WALL_PROFILE ?? '/tmp/slopboard',
  /** How a page is turned into a picture. Chrome rather than a driver: it is
   *  already installed, already spawned for the alerts, and a headless driver
   *  is a 150MB dependency for one screenshot. */
  shotBrowser:
    process.env.SLOP_SHOT_BROWSER ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  /** The viewport a page is shot in. `--screenshot` captures the viewport and
   *  not the document, so a short page leaves empty card. */
  shotWidth: Number(process.env.SLOP_SHOT_WIDTH ?? 1280),
  shotHeight: Number(process.env.SLOP_SHOT_HEIGHT ?? 800),
  /** The viewport a mesh is postered in. Square, because the subject is an
   *  object in space rather than a document. */
  meshShotEdge: Number(process.env.SLOP_MESH_SHOT_EDGE ?? 1024),
  /** Longer than a page's: the mesh is drawn by software GL, and `ingestAtOnce`
   *  of them can be drawing at the same time on the same cores. Measured: three
   *  at once miss a 15s ceiling that one meets in three seconds. */
  meshShotTimeoutMs: Number(process.env.SLOP_MESH_SHOT_TIMEOUT_MS ?? 45_000),
  /** Chrome does not exit after writing the shot, so the daemon kills it. This
   *  is how long the page gets to finish painting first. */
  shotTimeoutMs: Number(process.env.SLOP_SHOT_TIMEOUT_MS ?? 15_000),
  /** How a video is turned into a picture, and how its runtime is read.
   *  `bin/slop` refuses a video when the first is not on PATH, so a file the
   *  daemon could not poster never lands in the inbox to sit there forever. */
  ffmpeg: process.env.SLOP_FFMPEG ?? 'ffmpeg',
  ffprobe: process.env.SLOP_FFPROBE ?? 'ffprobe',
  /** Where the poster is seeked from. A fade-in or a screen recording opens on
   *  black often enough that frame 0 is the worse default; anything shorter
   *  than this falls back to it. */
  posterAtMs: parseDuration(process.env.SLOP_POSTER_AT ?? '1s') ?? 1000,
  /** ffmpeg exits on its own, unlike Chrome. This is the ceiling on a file
   *  pathological enough not to.  */
  posterTimeoutMs: Number(process.env.SLOP_POSTER_TIMEOUT_MS ?? 20_000),
}
