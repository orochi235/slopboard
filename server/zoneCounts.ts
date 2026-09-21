import { join } from 'node:path'
import { config } from './config.ts'
import type { WallItem } from '@shared/protocol.ts'

export type ZoneCount = { zone: string; items: number; path: string; icon: string }

/**
 * How much each zone is holding, busiest first. The path rides along so that
 * a caller outside this machine's shell — the menu bar widget — can open a
 * zone's folder without being told where the inbox is, and so does the icon
 * its project's `.hued` names, or "" where it names none.
 */
export function zoneCounts(
  items: readonly WallItem[],
  icons: Readonly<Record<string, string>> = {},
): ZoneCount[] {
  const byZone = new Map<string, number>()
  for (const i of items) byZone.set(i.zone, (byZone.get(i.zone) ?? 0) + 1)
  return [...byZone]
    .map(([zone, count]) => ({
      zone,
      items: count,
      path: join(config.inbox, zone),
      icon: icons[zone] ?? '',
    }))
    .sort((a, b) => b.items - a.items || a.zone.localeCompare(b.zone))
}
