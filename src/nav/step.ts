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
