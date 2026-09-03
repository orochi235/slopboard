import type { StackParams } from '@/params.ts'

const KEY = 'slopboard.params.v1'

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
    return raw === null ? defaults : mergeStored(defaults, JSON.parse(raw))
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
