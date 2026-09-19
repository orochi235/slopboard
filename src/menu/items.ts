import type { WallItem } from '@shared/protocol.ts'

/** What the pointer was over. The chain `chainAt` returns, named. */
export type Target =
  | { kind: 'card'; zone: string; id: string }
  | { kind: 'zone'; zone: string }
  | { kind: 'sky' }

export type Action =
  | 'open'
  | 'pin'
  | 'unpin'
  /** Held at the top of the wall, or let back into the order. A zone's own
   *  pair: `pin` rescues one artifact from expiry, which is a different thing
   *  under the same word. The two never share a menu — a target is a card or a
   *  zone — so only the code has to tell them apart. */
  | 'pinZone'
  | 'unpinZone'
  | 'configureZone'
  | 'expire'
  | 'expireZone'
  | 'copyArtifact'
  | 'copyPath'
  | 'dismiss'
  | 'undo'

export type Item = {
  action: Action
  label: string
  /** Set on the one action that takes something away, so the menu can mark it
   *  without knowing which action that is. */
  grave?: boolean
}

export function targetOf(chain: readonly string[]): Target {
  const [zone, id] = chain
  if (zone && id) return { kind: 'card', zone, id }
  if (zone) return { kind: 'zone', zone }
  return { kind: 'sky' }
}

/**
 * The menu for a target, in the order it reads.
 *
 * "Unpin" rather than "drop" or "free", which both read as throwing the image
 * away — the item directly below this one.
 */
export function menuFor(
  target: Target,
  ctx: {
    item?: WallItem
    canUndo: boolean
    /** How many artifacts the zone holds, so the row says what it costs. */
    zoneCount?: number
    /** Whether the zone is already held at the top. */
    zonePinned?: boolean
    /** The row that has been clicked once and is waiting to be meant. */
    armed?: Action | null
  },
): Item[] {
  const items: Item[] = []
  if (target.kind === 'card' && ctx.item) {
    items.push({ action: 'open', label: 'Open' })
    items.push(
      ctx.item.keptAt
        ? { action: 'unpin', label: 'Unpin' }
        : { action: 'pin', label: 'Pin' },
    )
    if (ctx.item.attention) items.push({ action: 'dismiss', label: 'Dismiss the flag' })
    items.push({ action: 'copyArtifact', label: 'Copy artifact' })
    items.push({ action: 'copyPath', label: 'Copy path' })
    items.push({ action: 'expire', label: 'Expire now', grave: true })
  }
  // Taking a zone is the one gesture that can take thirty artifacts at once,
  // so the row says how many and has to be clicked twice. Not a `confirm()`:
  // a browser modal blocks the page's event loop, and the count is the whole
  // content of the question anyway.
  if (target.kind === 'zone' && (ctx.zoneCount ?? 0) > 0) {
    const n = ctx.zoneCount ?? 0
    items.push({ action: 'configureZone', label: 'Configure the zone…' })
    items.push(
      ctx.zonePinned
        ? { action: 'unpinZone', label: 'Unpin the zone' }
        : { action: 'pinZone', label: 'Pin the zone to the top' },
    )
    items.push({
      action: 'expireZone',
      label:
        ctx.armed === 'expireZone'
          ? `Really — expire ${n}`
          : `Expire the zone (${n})`,
      grave: true,
    })
  }
  if (ctx.canUndo) items.push({ action: 'undo', label: 'Undo last expiry' })
  return items
}
