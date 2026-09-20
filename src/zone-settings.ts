import type { Backdrop } from '@shared/backdrops.ts'
import type { ZoneSettings } from '@shared/protocol.ts'

/**
 * What a zone actually gets, once its own overrides are laid over the wall's.
 * One place, because the wall, its plan and the sheet that sets these all have
 * to agree — a zone drawn in one tint on the wall and another on the plan
 * reads as two zones.
 */

/**
 * The colors the wall draws zones in: the project's `.hued`, with a zone's own
 * choice over the top. The shape `zoneColors` already has, so everything
 * downstream keeps reading one map and never learns there is an override.
 */
export function tintsFor(
  zoneColors: Record<string, string>,
  settings: Record<string, ZoneSettings>,
): Record<string, string> {
  const out = { ...zoneColors }
  for (const [zone, own] of Object.entries(settings)) if (own.color) out[zone] = own.color
  return out
}

/** What one zone is ruled with: its own pattern, else the wall's. */
export const backdropFor = (settings: ZoneSettings | undefined, wall: Backdrop): Backdrop =>
  settings?.backdrop ?? wall

/** The pitch one zone is ruled at: its own, else the wall's. */
export const spacingFor = (settings: ZoneSettings | undefined, wall: number): number =>
  settings?.spacing ?? wall
