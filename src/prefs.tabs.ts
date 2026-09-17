export type PrefsTab = {
  id: string
  label: string
  /** 0 for a surface, 1 for a group nested under one. */
  depth: 0 | 1
  /** The param group this tab shows alone. Absent shows every group. */
  group?: string
}

export const ALL = 'params'

/**
 * The sheet's tab list: the surfaces, and under `params` one tab per group.
 * Built from the groups rather than written out, so the list follows the
 * groups as they are folded together.
 */
export function prefsTabs(groups: readonly string[]): PrefsTab[] {
  return [
    { id: ALL, label: ALL, depth: 0 },
    ...groups.map((group): PrefsTab => ({ id: `${ALL}.${group}`, label: group, depth: 1, group })),
  ]
}

/** The remembered tab if the list still has it, else the whole of params. */
export function resolveTab(tabs: readonly PrefsTab[], id: string | null): PrefsTab {
  return tabs.find((tab) => tab.id === id) ?? tabs[0] ?? { id: ALL, label: ALL, depth: 0 }
}

/** The tab `delta` rows from `id`, wrapping at either end. */
export function stepTab(tabs: readonly PrefsTab[], id: string, delta: number): PrefsTab {
  const at = Math.max(0, tabs.findIndex((tab) => tab.id === id))
  const next = tabs[(at + delta + tabs.length) % tabs.length]
  return next ?? resolveTab(tabs, id)
}
