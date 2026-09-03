export type ViewState =
  | { kind: 'wall' }
  | { kind: 'stack'; zone: string }
  | { kind: 'lightbox'; zone: string; id: string }

export type ViewAction =
  | { type: 'zoom'; zone: string }
  | { type: 'open'; id: string }
  | { type: 'escape' }
  /** The daemon owns item lifetime, so a zone can vanish under the camera. */
  | { type: 'zones'; live: readonly string[] }

export const WALL: ViewState = { kind: 'wall' }

export function reduceView(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'zoom':
      return { kind: 'stack', zone: action.zone }
    case 'open':
      return state.kind === 'wall' ? state : { kind: 'lightbox', zone: state.zone, id: action.id }
    case 'escape':
      if (state.kind === 'lightbox') return { kind: 'stack', zone: state.zone }
      if (state.kind === 'stack') return WALL
      return state
    case 'zones':
      if (state.kind === 'wall') return state
      return action.live.includes(state.zone) ? state : WALL
  }
}
