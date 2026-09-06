import type { StackParams } from '@/params.ts'

const KEY = 'slopboard.params.v2'

/** The key v2 replaced. Read once, migrated, and removed. */
const KEY_V1 = 'slopboard.params.v1'

/**
 * Subtrees a stored panel must give back rather than carry across a version.
 *
 * `mergeStored` keeps any stored value whose type matches, which is right for a
 * tuning and wrong for a parameter whose *meaning* changed underneath it: it
 * cannot tell `lift: 0.4` in world z from `lift: 0.4` in ranks along the pile's
 * axis, because both are numbers. Anything listed here is dropped from an
 * inherited blob so the new default wins, and everything else is kept — a panel
 * tuned over weeks should not be thrown away to fix one subtree.
 */
const RESET_ON_MIGRATE = ['attention'] as const

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

    const old = storage.getItem(KEY_V1)
    if (old === null) return defaults
    const blob = JSON.parse(old) as Record<string, unknown>
    for (const subtree of RESET_ON_MIGRATE) delete blob[subtree]
    const merged = mergeStored(defaults, blob)
    // Written through immediately, so a browser that never changes a parameter
    // again still stops re-reading the old blob on every load.
    saveParams(merged, storage)
    storage.removeItem(KEY_V1)
    return merged
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
