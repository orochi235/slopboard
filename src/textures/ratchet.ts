import type { LodTier } from '@/params.ts'

export type Edge = LodTier['edge']

/**
 * An item's texture only ever shrinks. Rank rises while its neighbours live, so
 * a larger request is either a stale frame or a zoom — and zoom re-decodes
 * deliberately rather than through this path.
 */
export function ratchet(held: Edge | undefined, want: Edge): Edge {
  if (held === undefined) return want
  return want < held ? want : held
}
