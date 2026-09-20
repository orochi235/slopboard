import { readFile } from 'node:fs/promises'
import { save } from './atomic.ts'
import { join } from 'node:path'
import { config } from './config.ts'

const file = join(config.root, 'pins.json')

/**
 * Which zones are held at the top of the wall, and since when.
 *
 * A file of its own rather than the sidecars the items use: a zone is not an
 * artifact and owns no file to sit beside. Dates are ISO strings on disk and
 * milliseconds everywhere else, following the sidecar — this is a file someone
 * may open and edit, and the wall reads a number.
 */
export async function readPins(): Promise<Record<string, number>> {
  let blob: unknown
  try {
    blob = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return {}
  }
  const zones = (blob as { zones?: unknown })?.zones
  if (zones === null || typeof zones !== 'object' || Array.isArray(zones)) return {}

  const out: Record<string, number> = {}
  for (const [zone, when] of Object.entries(zones as Record<string, unknown>)) {
    if (typeof when !== 'string') continue
    const at = Date.parse(when)
    // A date that means nothing is dropped rather than holding a zone at the
    // top of every wall forever, which nothing in the UI would explain.
    if (!Number.isNaN(at)) out[zone] = at
  }
  return out
}

/** Pins a zone or lets it go. Returns when it was pinned, or null for the
 *  second — the shape the route and the socket message both carry. */
export async function setPinned(zone: string, on: boolean): Promise<number | null> {
  const zones = await readPins()
  const at = on ? Date.now() : null
  if (at === null) delete zones[zone]
  else zones[zone] = at

  const held: Record<string, string> = {}
  for (const [name, when] of Object.entries(zones)) held[name] = new Date(when).toISOString()
  await save(file, `${JSON.stringify({ zones: held })}\n`)
  return at
}
