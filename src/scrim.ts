/**
 * Telling a real click from the tail of a drag.
 *
 * A pointer that goes down on a slider and comes up somewhere else still fires
 * a `click`, and that click targets wherever the pointer *ended*. So anything
 * clickable near a track will fire when a drag overshoots onto it: the wall
 * loses the value that was just set, or the sheet closes under the hand. Both
 * of those shipped, and both look like the slider being broken rather than like
 * a neighbor stealing the release.
 *
 * The rule for either case is the same — a click counts only where the press
 * that started it landed on the same thing.
 */

/** Whether the press that ended in this click landed on `target` itself. */
export function pressedOn(down: EventTarget | null, target: EventTarget | null): boolean {
  return down !== null && down === target
}

/**
 * Whether a click on a dialog's scrim should close it: the press and the
 * release both landed on the scrim, rather than the release alone.
 */
export function closesDialog(
  down: EventTarget | null,
  click: EventTarget | null,
  scrim: EventTarget | null,
): boolean {
  return pressedOn(down, scrim) && click === scrim
}
