import type { StackParams } from '@/params.ts'

/**
 * Groups no arrangement reads. `createStack` closes over its params, so any
 * group the strategy *does* read has to stay in the key or a change to it never
 * reaches the wall — which is why this is a list of what to drop rather than a
 * list of what to keep. Forgetting to drop one costs a reshuffle; forgetting to
 * keep one costs a parameter that silently does nothing.
 */
const DISPLAY_ONLY = ['camera', 'overlay', 'zones', 'sky', 'colors', 'nav', 'attention', 'typeface', 'prefs'] as const

/**
 * Leaves inside a group the arrangement *does* read. `lod` shapes the piles
 * through `lodFor` and `rankCap`, so the group has to stay; when the wall
 * reveals itself and what the texture budget is are the backend's alone.
 */
const DISPLAY_ONLY_LEAVES = ['lod.revealHoldMs', 'lod.revealFadeMs', 'lod.budgetBytes'] as const

/**
 * Identity for the arrangement memo. Rebuilding resets the rank allocators, so
 * every pile on the wall snaps — turning the camera or dragging a colour must
 * not do that.
 */
export function layoutKeyOf(params: StackParams): string {
  const rest: Record<string, unknown> = { ...params }
  for (const key of DISPLAY_ONLY) delete rest[key]
  for (const path of DISPLAY_ONLY_LEAVES) {
    const [group, leaf] = path.split('.') as [string, string]
    const held = rest[group] as Record<string, unknown> | undefined
    if (!held) continue
    const { [leaf]: _display, ...kept } = held
    rest[group] = kept
  }
  return JSON.stringify(rest)
}
