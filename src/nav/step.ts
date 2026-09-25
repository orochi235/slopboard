/**
 * The one path a step inward lands on, given where the view is and the full
 * chain under the cursor. Null for a step that has nowhere to go.
 *
 * A step is either across or down, never both: a cursor over a different pile
 * spends the step moving there, and only the next one descends. So the camera
 * never arrives somewhere the eye did not watch it travel.
 */
export function stepToward(
  path: readonly string[],
  target: readonly string[],
): readonly string[] | null {
  if (target.length === 0) return null

  for (let i = 0; i < path.length && i < target.length; i++) {
    if (path[i] !== target[i]) return target.slice(0, i + 1)
  }

  return target.length > path.length ? target.slice(0, path.length + 1) : null
}

/**
 * Where a click lands, which at the wall is not one rung.
 *
 * The wall answers "which zone is producing" by being looked at, so a click on
 * one is already asking the next question — what did it make. Spending that
 * click on a rung means clicking twice before anything can be read, and the
 * first of the two shows a pile the eye had already taken in. So a click
 * anywhere on a zone, its backdrop or any card in it opens that zone's top
 * card, and `shift` keeps the rung for the times the pile itself is the thing
 * being looked at.
 *
 * Only at the wall: every deeper view steps, and the lightbox is the floor.
 */
export function clickToward(
  path: readonly string[],
  chain: readonly string[],
  frontOf: (zone: string) => string | undefined,
  shift = false,
): readonly string[] | null {
  const zone = chain[0]
  if (shift || path.length !== 0 || zone === undefined) return stepToward(path, chain)
  const front = frontOf(zone)
  // A zone with nothing in it has no top card to open, so the click falls back
  // to focusing the pile rather than doing nothing at all.
  return front === undefined ? [zone] : [zone, front]
}
