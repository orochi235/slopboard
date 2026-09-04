/**
 * A gate that lets at most `n` tasks run at once, starting waiting ones in
 * the order they arrived.
 *
 * Each call resolves or rejects with its own task's outcome, so a caller
 * cannot tell that it waited — and a task that throws returns its slot, or one
 * unreadable file would stop every arrival behind it.
 */
export function createLimiter(n: number) {
  const cap = Math.max(1, Math.floor(n))
  const waiting: (() => void)[] = []
  let active = 0

  return function gate<T>(task: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active++
        // The task is called inside the async body, so one that throws before
        // its first await rejects like any other rather than escaping here.
        void (async () => {
          try {
            resolve(await task())
          } catch (err) {
            reject(err)
          } finally {
            active--
            waiting.shift()?.()
          }
        })()
      }

      if (active < cap) start()
      else waiting.push(start)
    })
  }
}
