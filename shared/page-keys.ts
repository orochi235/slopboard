/**
 * How a page artifact hands the wall's keys back to it.
 *
 * A page is framed with `allow-scripts` and no `allow-same-origin`, so it is
 * an opaque origin and a keydown in it never reaches the wall's own `window`
 * listener. Granting the origin would fix that and would also let any pushed
 * page delete its own sandbox attribute and reload out of it, so the keys
 * travel by `postMessage` and the frame stays sealed.
 */

/** Up and down stay the page's: they scroll it, and the wall does nothing with
 *  them while a card is open. */
export const FORWARDED_KEYS = ['Escape', 'ArrowLeft', 'ArrowRight'] as const

/** Named, so a message from any other frame cannot be mistaken for one. */
export const KEY_MESSAGE = 'slopboard:key'
