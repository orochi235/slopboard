import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatchdog } from '@/watchdog.ts'

describe('createWatchdog', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('bites once the feed has been silent for the whole window', () => {
    const bite = vi.fn()
    createWatchdog(1000, bite)
    vi.advanceTimersByTime(999)
    expect(bite).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(bite).toHaveBeenCalledTimes(1)
  })

  it('restarts the window on every feed', () => {
    const bite = vi.fn()
    const dog = createWatchdog(1000, bite)
    vi.advanceTimersByTime(800)
    dog.feed()
    vi.advanceTimersByTime(800)
    expect(bite).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(bite).toHaveBeenCalledTimes(1)
  })

  it('bites at most once, and never after a stop', () => {
    const bite = vi.fn()
    const dog = createWatchdog(1000, bite)
    vi.advanceTimersByTime(1000)
    dog.feed()
    vi.advanceTimersByTime(5000)
    expect(bite).toHaveBeenCalledTimes(1)

    const quiet = vi.fn()
    createWatchdog(1000, quiet).stop()
    vi.advanceTimersByTime(5000)
    expect(quiet).not.toHaveBeenCalled()
  })
})
