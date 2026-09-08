/**
 * Whether a wheel event begins a new gesture or continues the one before it,
 * read off the gap since the previous event.
 *
 * A gap is the only signal that separates a hand from its momentum: a tail
 * delivers at frame intervals for most of a second and never opens one, and no
 * fixed dead time is both longer than the longest tail and shorter than the
 * pause between two deliberate pushes.
 *
 * `startedAt` is for a consumer that comes into existence mid-gesture and must
 * not treat the tail already in flight as a push of its own.
 */
export function createQuietGate(quietMs: number, startedAt = Number.NEGATIVE_INFINITY) {
  let lastAt = startedAt
  return {
    feed(now: number): boolean {
      const fresh = now - lastAt >= quietMs
      lastAt = now
      return fresh
    },
  }
}
