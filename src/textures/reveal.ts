/**
 * How far the wall has faded in, 0..1.
 *
 * A card with no texture yet is a placeholder, and a hundred placeholders
 * turning into pictures over a few hundred milliseconds reads as the artifacts
 * arriving one at a time rather than as a wall that is already there. So the
 * wall stays dark until the fronts of the piles have decoded, then shows
 * itself assembled.
 *
 * `holdMs` is a ceiling on that wait, not the wait itself: one image that never
 * decodes must not keep the wall off.
 */
export function createReveal() {
  let firstAt: number | null = null
  let openedAt: number | null = null

  return (o: {
    now: number
    /** Cards drawing at the top LOD tier — the front of every pile. */
    fronts: number
    /** How many of those already have their texture. */
    ready: number
    holdMs: number
    fadeMs: number
  }): number => {
    if (o.holdMs <= 0) return 1
    if (firstAt === null) firstAt = o.now
    if (openedAt === null) {
      const settled = o.fronts > 0 && o.ready >= o.fronts
      if (!settled && o.now - firstAt < o.holdMs) return 0
      openedAt = o.now
    }
    if (o.fadeMs <= 0) return 1
    return Math.min(1, (o.now - openedAt) / o.fadeMs)
  }
}
