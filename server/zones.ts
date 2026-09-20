import { readFile, rename } from 'node:fs/promises'
import { save } from './atomic.ts'
import { join } from 'node:path'
import { config } from './config.ts'
import { isBackdrop } from '@shared/backdrops.ts'
import {
  formatLifetime,
  isHold,
  parseLifetime,
  type Lifetime,
} from '@shared/lifetime.ts'
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

/** A lifetime the wall will hold, or null. A hold is always held: the bounds
 *  exist to stop a number so large nothing ever leaves, and saying so outright
 *  is not that mistake — it is the setting that mistake was imitating. */
const heldLifetime = (lifetime: Lifetime | null): Lifetime | null => {
  if (lifetime === null) return null
  if (isHold(lifetime)) return lifetime
  return lifetime >= bounds.min && lifetime <= bounds.max ? lifetime : null
}

/** The pitches the wall will rule at, matching the range the panel's own
 *  slider offers. Below the floor the pattern is a flat tint and above the
 *  ceiling a cell holds one line, so neither end says anything. */
const pitch = { min: 0.002, max: 0.1 }

/** A pitch the wall will rule at, or null. */
const heldSpacing = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= pitch.min && raw <= pitch.max
    ? raw
    : null

/** An angle in degrees, wrapped into one turn. Any number is a legal angle, so
 *  this refuses nothing a number can say — it only picks the representative. */
const heldAngle = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) ? ((raw % 360) + 360) % 360 : null

let zones: Record<string, ZoneSettings> = {}

/** One stored entry, less anything this build cannot use. A zone whose record
 *  is junk inherits, which is what it did before anyone configured it. */
function clean(raw: unknown): ZoneSettings {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const blob = raw as {
    color?: unknown
    backdrop?: unknown
    spacing?: unknown
    period?: unknown
    angle?: unknown
    ttl?: unknown
  }
  const out: ZoneSettings = {}
  if (typeof blob.color === 'string' && HEX.test(blob.color)) out.color = blob.color
  if (isBackdrop(blob.backdrop)) out.backdrop = blob.backdrop
  const spacing = heldSpacing(blob.spacing)
  if (spacing !== null) out.spacing = spacing
  const period = heldSpacing(blob.period)
  if (period !== null) out.period = period
  const angle = heldAngle(blob.angle)
  if (angle !== null) out.angle = angle
  if (typeof blob.ttl === 'string') {
    const held = heldLifetime(parseLifetime(blob.ttl))
    if (held !== null) out.lifetime = held
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
        ...(s.spacing === undefined ? {} : { spacing: s.spacing }),
        ...(s.period === undefined ? {} : { period: s.period }),
        ...(s.angle === undefined ? {} : { angle: s.angle }),
        ...(s.lifetime === undefined ? {} : { ttl: formatLifetime(s.lifetime) }),
      },
    ]),
  ),
})

export async function load(): Promise<void> {
  zones = {}
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch {
    // No file yet. Every zone inherits, which is what it did before anyone
    // configured one.
    return
  }
  let blob: unknown
  try {
    blob = JSON.parse(text)
  } catch {
    // A file that exists and will not parse is somebody's settings, not an
    // absence — carrying on as though every zone inherits loses them the
    // moment the next write rebuilds the file from an empty map. Moved aside
    // rather than read or overwritten, and said out loud.
    const kept = `${file}.corrupt-${Date.now()}`
    await rename(file, kept).catch(() => {})
    console.error(`[zone] ${file} did not parse. Moved to ${kept}; every zone inherits until it is put back.`)
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
export const lifetimeFor = (zone: string): Lifetime | undefined => zones[zone]?.lifetime

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
    spacing?: number | null
    period?: number | null
    angle?: number | null
    lifetime?: Lifetime | null
  },
): Promise<ZoneSettings> {
  const next: ZoneSettings = { ...settingsFor(zone) }

  if (patch.color === null) delete next.color
  else if (typeof patch.color === 'string' && HEX.test(patch.color)) next.color = patch.color

  if (patch.backdrop === null) delete next.backdrop
  else if (isBackdrop(patch.backdrop)) next.backdrop = patch.backdrop
  // Said out loud: a page served by a newer build offers patterns this daemon
  // has never heard of, and dropping those without a word looks from the sheet
  // exactly like a swatch that cannot be picked.
  else if (patch.backdrop !== undefined)
    console.warn(`[zone] ${zone} asked for backdrop ${JSON.stringify(patch.backdrop)} — restart me`)

  if (patch.spacing === null) delete next.spacing
  else if (patch.spacing !== undefined) {
    const held = heldSpacing(patch.spacing)
    if (held !== null) next.spacing = held
  }

  if (patch.period === null) delete next.period
  else if (patch.period !== undefined) {
    const held = heldSpacing(patch.period)
    if (held !== null) next.period = held
  }

  if (patch.angle === null) delete next.angle
  else if (patch.angle !== undefined) {
    const held = heldAngle(patch.angle)
    if (held !== null) next.angle = held
  }

  if (patch.lifetime === null) delete next.lifetime
  else if (patch.lifetime !== undefined) {
    const held = heldLifetime(
      typeof patch.lifetime === 'number' && !Number.isFinite(patch.lifetime)
        ? null
        : patch.lifetime,
    )
    if (held !== null) next.lifetime = held
  }

  if (Object.keys(next).length > 0) zones[zone] = next
  else delete zones[zone]

  await save(file, `${JSON.stringify(onDisk(zones), null, 2)}\n`)
  return settingsFor(zone)
}
