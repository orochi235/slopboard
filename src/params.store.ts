import type { StackParams } from '@/params.ts'

const KEY = 'transom.params.v3'

/**
 * The keys this one replaced, newest first, each with the subtrees a panel
 * found under it has to give back.
 *
 * `mergeStored` keeps any stored value whose type matches, which is right for a
 * tuning and wrong for a parameter whose *meaning* changed underneath it: it
 * cannot tell `lift: 0.4` in world z from `lift: 0.4` in ranks along the pile's
 * axis, because both are numbers. A listed subtree is dropped so the new
 * default wins, and everything else is kept — a panel tuned over weeks should
 * not be thrown away to fix one subtree.
 *
 * Each entry lists every reset from its own version forward, so a panel that
 * skips a version still gives back what the skipped one would have taken.
 * `prefs` is here because its stage moved from the sheet to the scrim: a
 * `swing` measured against a 1130px sheet is a different quantity from one
 * measured against the viewport, and carried across it pins the modal at a
 * tenth of the travel it is asking for.
 */
const LEGACY = [
  { key: 'transom.params.v2', reset: ['prefs'] },
  { key: 'transom.params.v1', reset: ['prefs', 'attention'] },
] as const

/**
 * Stored values over defaults, key by key. The defaults are the shape: a key
 * they no longer have is dropped and one they have that the blob lacks is
 * kept, so adding or retiring a parameter never strands a stored panel. A
 * stored value whose type disagrees with the default is ignored — that is a
 * renamed parameter, not a tuning.
 */
export function mergeStored<T>(defaults: T, stored: unknown): T {
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return defaults
  if (defaults === null || typeof defaults !== 'object') return defaults

  const blob = stored as Record<string, unknown>
  const out = { ...(defaults as Record<string, unknown>) }
  for (const [key, fallback] of Object.entries(out)) {
    if (!(key in blob)) continue
    const value = blob[key]
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) out[key] = value
    } else if (fallback !== null && typeof fallback === 'object') {
      out[key] = mergeStored(fallback, value)
    } else if (typeof value === typeof fallback) {
      out[key] = value
    }
  }
  return out as T
}

/** Storage throws rather than returning null in a private window, so every
 *  access is guarded: a wall that will not load is worse than an untuned one. */
export function loadParams(defaults: StackParams, storage: Storage = localStorage): StackParams {
  try {
    const raw = storage.getItem(KEY)
    if (raw !== null) return mergeStored(defaults, JSON.parse(raw))

    for (const { key, reset } of LEGACY) {
      const old = storage.getItem(key)
      if (old === null) continue
      const blob = JSON.parse(old) as Record<string, unknown>
      for (const subtree of reset) delete blob[subtree]
      const merged = mergeStored(defaults, blob)
      // Written through immediately, so a browser that never changes a
      // parameter again still stops re-reading the old blob on every load.
      saveParams(merged, storage)
      // Every legacy key, not just the one read: a stale older blob left
      // beside it would be found the moment this one was cleared.
      for (const stale of LEGACY) storage.removeItem(stale.key)
      return merged
    }
    return defaults
  } catch {
    return defaults
  }
}

export function saveParams(params: StackParams, storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(params))
  } catch {
    // A full or refused store costs a tuning, not the wall.
  }
}
