import type { Category } from '@/params.tabs.ts'

export type PrefsTab = {
  id: string
  label: string
  /** 0 for a surface, 1 for an area nested under one. */
  depth: 0 | 1
  /** The category this tab shows alone. Absent shows everything. */
  category?: string
}

export const ALL = 'params'
export const WALL = 'wall'

/**
 * The sheet's tab list: the surfaces — `params`, with one nested tab per area
 * of the wall, then `wall` — built from the categories the leaves actually land
 * in, so a tab with nothing in it is not offered.
 */
export function prefsTabs(categories: readonly Category[]): PrefsTab[] {
  return [
    { id: ALL, label: ALL, depth: 0 },
    ...categories.map(
      (c): PrefsTab => ({ id: `${ALL}.${c.id}`, label: c.label, depth: 1, category: c.id }),
    ),
    // The daemon's own settings, under the browser's: what the wall is, rather
    // than how this browser draws it.
    { id: WALL, label: WALL, depth: 0 },
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
