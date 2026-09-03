import type { LayoutItem } from 'windease'
import type { WallItem } from '@shared/protocol.ts'

/** What `createStack`'s strategy reads: a windease item plus the two fields the
 *  arrangement needs. `aspect` is for the mesh, never for the layout. */
export type StackItem = LayoutItem & { zone: string; age01: number; aspect: number }

/** `now` is the daemon's clock, not the browser's — decay stays server-anchored
 *  so a reload changes nothing about the wall. */
export function toStackItems(
  items: readonly WallItem[],
  clock: { now: number; ttlMs: number },
): StackItem[] {
  return items.map((i) => ({
    id: i.id,
    zone: i.zone,
    age01: Math.max(0, Math.min(1, (clock.now - i.bornAt) / clock.ttlMs)),
    aspect: i.h > 0 ? i.w / i.h : 1,
  }))
}
