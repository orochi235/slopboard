import type { Control } from '@/params.controls.ts'

export type ControlGroup = { name: string; controls: Control[] }

/** Top-level scalars have no prefix to group by; they are the wall's own. */
const TOP = 'wall'

/**
 * One group per first path segment, so the panel is sections rather than one
 * long column. Order is first appearance — a group that moved as its contents
 * changed would cost the muscle memory the panel is tuned by — except the
 * top-level scalars, which lead.
 */
export function groupControls(controls: Control[]): ControlGroup[] {
  const byName = new Map<string, Control[]>()
  for (const control of controls) {
    const dot = control.path.indexOf('.')
    const name = dot === -1 ? TOP : control.path.slice(0, dot)
    const bucket = byName.get(name)
    if (bucket) bucket.push(control)
    else byName.set(name, [control])
  }

  const groups = [...byName].map(([name, list]) => ({ name, controls: list }))
  return groups.sort((a, b) => Number(b.name === TOP) - Number(a.name === TOP))
}
