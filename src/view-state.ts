/**
 * Where the view is, as a path from the wall down. `[]` is the wall itself,
 * `['weasel']` a pile with focus, `['weasel', 'img-1']` a card.
 *
 * A path rather than a case per level, because the navigation has to hold for
 * however many rungs the hierarchy grows. What a rung *means* — which box the
 * camera frames, whether it is drawn in the scene or raised as an overlay —
 * stays with the renderer, which is where a new rung's geometry has to be
 * taught anyway.
 */
export type ViewState = { path: readonly string[] }

export type ViewAction =
  /** Climb one rung. At the wall there is nowhere further out. */
  | { type: 'out' }
  /** Land on a path outright. Descending is this too: `stepToward` owns the
   *  rule that a gesture moves one rung, so the reducer need not. */
  | { type: 'to'; path: readonly string[] }
  /** The daemon owns item lifetime, so a zone can vanish under the camera. */
  | { type: 'prune'; live: readonly string[] }

export const WALL: ViewState = { path: [] }

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => b[i] === v)

export function reduceView(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'out':
      return state.path.length === 0 ? state : { path: state.path.slice(0, -1) }
    case 'to':
      return same(state.path, action.path) ? state : { path: action.path }
    case 'prune': {
      const zone = state.path[0]
      if (zone === undefined) return state
      return action.live.includes(zone) ? state : WALL
    }
  }
}

/** How many rungs down the view sits. The renderer's one question of the path. */
export const depthOf = (state: ViewState): number => state.path.length

/** The two rungs this wall has today, named here and nowhere else, so growing
 *  the hierarchy is one file's problem. */
export const zoneOf = (state: ViewState): string | null => state.path[0] ?? null
export const cardOf = (state: ViewState): string | null => state.path[1] ?? null
