/**
 * Draw order for things that are signage rather than scenery.
 *
 * Zone names and attention badges composite above the wall instead of sorting
 * into it: both are transparent, and three sorts the transparent bucket back
 * to front, so without this a nearer pile buries the very thing that is asking
 * to be looked at. Its own module because both the backend and the zone
 * overlay need it, and importing one from the other is a cycle.
 */
export const CHROME_ORDER = 10

/** Chips sit under the badges. Both composite over the wall, so with one order
 *  between them which covers which is whatever three sorted last — and the
 *  plate a flag stood off on the ladder is the thing being asked about. */
export const CHIP_ORDER = CHROME_ORDER - 1
