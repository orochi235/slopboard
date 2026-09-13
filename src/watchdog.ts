export type Watchdog = {
  /** Proof of life: restarts the window. */
  feed: () => void
  stop: () => void
}

/** Calls `onSilent` once, if `feed` goes `ms` without being called. The window
 *  starts at creation. */
export function createWatchdog(ms: number, onSilent: () => void): Watchdog {
  let timer: ReturnType<typeof setTimeout> | undefined
  let done = false
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      done = true
      onSilent()
    }, ms)
  }
  arm()
  return {
    feed: () => {
      if (!done) arm()
    },
    stop: () => {
      done = true
      clearTimeout(timer)
    },
  }
}
