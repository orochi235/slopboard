const MARK = '#carry='
const OURS = 'transom.'

/**
 * Settings handed over from another address, as `#carry=<JSON of key to value>`.
 *
 * Storage belongs to a scheme, host and port, so a wall that moves port opens
 * on an empty one and a panel tuned over weeks stays behind. The page at the
 * old address sends its keys here in the fragment. Only this app's keys are
 * taken, and only where nothing is stored yet, so a link cannot overwrite a
 * tuning.
 *
 * True when the fragment was a handover, whatever it held: the caller clears
 * it, because the wall reads the fragment as a view.
 */
export function carryIn(hash: string, storage: Storage): boolean {
  if (!hash.startsWith(MARK)) return false
  try {
    const carried: unknown = JSON.parse(decodeURIComponent(hash.slice(MARK.length)))
    if (carried === null || typeof carried !== 'object' || Array.isArray(carried)) return true
    for (const [key, value] of Object.entries(carried)) {
      if (!key.startsWith(OURS) || typeof value !== 'string') continue
      if (storage.getItem(key) === null) storage.setItem(key, value)
    }
  } catch {
    // A mangled handover or a refused store costs the settings, not the wall.
  }
  return true
}
