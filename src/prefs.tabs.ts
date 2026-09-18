import type { Category } from '@/params.tabs.ts'

export type PrefsTab = {
  id: string
  label: string
  /** 0 for a surface, 1 for an area nested under one. */
  depth: 0 | 1
  /** The category this tab shows alone. Absent shows everything. */
  category?: string
}

export const GENERAL = 'general'
export const ALL = 'params'

/**
 * The sheet's tab list: `general` first, then `params` with one nested tab per
 * area of the wall — built from the categories the leaves actually land in, so
 * a tab with nothing in it is not offered.
 *
 * `general` is the few settings worth finding first, drawn from wherever they
 * live rather than from one part of the wall, and it carries the daemon's own
 * lifetime too — the one setting here that holds for every browser rather than
 * this one.
 */
export function prefsTabs(categories: readonly Category[]): PrefsTab[] {
  return [
    { id: GENERAL, label: GENERAL, depth: 0, category: GENERAL },
    { id: ALL, label: ALL, depth: 0 },
    ...categories.map(
      (c): PrefsTab => ({ id: `${ALL}.${c.id}`, label: c.label, depth: 1, category: c.id }),
    ),
  ]
}

/** The remembered tab if the list still has it, else the first one. */
export function resolveTab(tabs: readonly PrefsTab[], id: string | null): PrefsTab {
  return (
    tabs.find((tab) => tab.id === id) ??
    tabs[0] ?? { id: GENERAL, label: GENERAL, depth: 0, category: GENERAL }
  )
}

/** The tab `delta` rows from `id`, wrapping at either end. */
export function stepTab(tabs: readonly PrefsTab[], id: string, delta: number): PrefsTab {
  const at = Math.max(0, tabs.findIndex((tab) => tab.id === id))
  const next = tabs[(at + delta + tabs.length) % tabs.length]
  return next ?? resolveTab(tabs, id)
}
