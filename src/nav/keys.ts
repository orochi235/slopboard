import type { Direction } from '@/nav/neighbor.ts'

/**
 * WASD and the arrows are the same four directions. PageUp/PageDown page a
 * pile wherever left and right do, so cycling a stack does not depend on
 * which hand is on which key.
 */
const KEYS: Record<string, Direction> = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
  pageup: 'left',
  pagedown: 'right',
}

export type KeySample = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}

/**
 * The direction a keystroke asks for, or null for one that is not the wall's.
 *
 * A modifier disqualifies it: Cmd-W belongs to the browser, and a wall that
 * navigates on the way to closing its own tab is worse than one that ignores
 * the key. Shift does not, since a capital W is still W.
 */
export function directionFor(e: KeySample): Direction | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return KEYS[e.key.toLowerCase()] ?? null
}

/**
 * Whether a keystroke was aimed at a control rather than at the wall. An arrow
 * steps a focused slider and a letter lands in a field; either way the wall
 * must not also move, which is the trap WASD walks into that the arrows only
 * grazed.
 */
export function isForAControl(target: EventTarget | null): boolean {
  const el = target as Element | null
  return !!el?.closest?.('input, select, textarea, button, [contenteditable]')
}
