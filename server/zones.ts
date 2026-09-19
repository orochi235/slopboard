import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.ts'
import { formatDuration, parseDuration } from '@shared/duration.ts'
import { isBackdrop } from '@shared/backdrops.ts'
import type { ZoneSettings } from '@shared/protocol.ts'

const file = join(config.root, 'zones.json')

/**
 * What each zone overrides about itself, against the wall's own defaults.
 *
 * A file of its own beside `pins.json`, for the same reason: a zone is not an
 * artifact and owns no file to sit beside. Durations are written the way
 * `settings.json` writes them and the way `SLOP_TTL` takes them, because this
 * is a file someone may open and edit.
 *
 * Held in memory as well as on disk: the sweeper asks for a zone's lifetime on
 * every pass over every item, and that cannot be a read.
 */

/** The lifetimes the wall will hold — too short to read, or so long nothing
 *  ever leaves. The same bounds `settings.ts` keeps for the wall's own. */
const bounds = { min: 60_000, max: 90 * 86_400_000 }

const HEX = /^#[0-9a-f]{6}$/i

let zones: Record<string, ZoneSettings> = {}

/** One stored entry, less anything this build cannot use. A zone whose record
 *  is junk inherits, which is what it did before anyone configured it. */
function clean(raw: unknown): ZoneSettings {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const blob = raw as { color?: unknown; backdrop?: unknown; ttl?: unknown }
  const out: ZoneSettings = {}
  if (typeof blob.color === 'string' && HEX.test(blob.color)) out.color = blob.color
  if (isBackdrop(blob.backdrop)) out.backdrop = blob.backdrop
  if (typeof blob.ttl === 'string') {
    const ms = parseDuration(blob.ttl)
    if (ms !== null && ms >= bounds.min && ms <= bounds.max) out.ttlMs = ms
  }
  return out
}

/** The shape on disk: a duration as a person writes it, and no empty records. */
const onDisk = (all: Record<string, ZoneSettings>) => ({
  zones: Object.fromEntries(
    Object.entries(all).map(([zone, s]) => [
      zone,
      {
        ...(s.color ? { color: s.color } : {}),
        ...(s.backdrop ? { backdrop: s.backdrop } : {}),
        ...(s.ttlMs ? { ttl: formatDuration(s.ttlMs) } : {}),
      },
    ]),
  ),
})

export async function load(): Promise<void> {
  zones = {}
  let blob: unknown
  try {
    blob = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    // No file yet, or one nobody can read. Every zone inherits.
    return
  }
  const stored = (blob as { zones?: unknown })?.zones
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return
  for (const [zone, raw] of Object.entries(stored as Record<string, unknown>)) {
    const settings = clean(raw)
    if (Object.keys(settings).length > 0) zones[zone] = settings
  }
}

/** Every zone that overrides something. Zones that inherit have no entry. */
export const all = (): Record<string, ZoneSettings> => zones

export const settingsFor = (zone: string): ZoneSettings => zones[zone] ?? {}

/** How long an artifact in this zone lives when it carries no TTL of its own,
 *  or undefined for a zone that leaves that to the wall. */
export const ttlFor = (zone: string): number | undefined => zones[zone]?.ttlMs

/**
 * Sets the fields a patch names and leaves the rest alone; `null` puts a field
 * back to inheriting. A value the wall cannot use is dropped rather than
 * refusing the whole patch — the sheet sends one field at a time, and a zone
 * half-set is easier to see than a write that silently did nothing.
 *
 * Returns what the zone overrides afterwards, which is `{}` for one that has
 * gone back to inheriting everything.
 */
export async function set(
  zone: string,
  patch: {
    color?: string | null
    backdrop?: ZoneSettings['backdrop'] | null
    ttlMs?: number | null
  },
): Promise<ZoneSettings> {
  const next: ZoneSettings = { ...settingsFor(zone) }

  if (patch.color === null) delete next.color
  else if (typeof patch.color === 'string' && HEX.test(patch.color)) next.color = patch.color

  if (patch.backdrop === null) delete next.backdrop
  else if (isBackdrop(patch.backdrop)) next.backdrop = patch.backdrop

  if (patch.ttlMs === null) delete next.ttlMs
  else if (
    typeof patch.ttlMs === 'number' &&
    Number.isFinite(patch.ttlMs) &&
    patch.ttlMs >= bounds.min &&
    patch.ttlMs <= bounds.max
  )
    next.ttlMs = patch.ttlMs

  if (Object.keys(next).length > 0) zones[zone] = next
  else delete zones[zone]

  await writeFile(file, `${JSON.stringify(onDisk(zones), null, 2)}\n`)
  return settingsFor(zone)
}
