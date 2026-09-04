import { describe, expect, it } from 'vitest'
import { createLimiter } from './limit.ts'

/** A task that resolves only when told, so concurrency is observable. */
function deferred<T = void>() {
  let settle: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

describe('createLimiter', () => {
  it('runs no more than the cap at once', async () => {
    const gate = createLimiter(2)
    let active = 0
    let peak = 0
    const gates = Array.from({ length: 6 }, () => deferred())

    const runs = gates.map((d, i) =>
      gate(async () => {
        active++
        peak = Math.max(peak, active)
        await d.promise
        active--
        return i
      }),
    )

    expect(peak).toBe(2)
    for (const d of gates) d.settle()
    expect(await Promise.all(runs)).toEqual([0, 1, 2, 3, 4, 5])
    expect(peak).toBe(2)
  })

  it('starts waiting tasks in the order they arrived', async () => {
    const gate = createLimiter(1)
    const order: number[] = []
    const runs = [1, 2, 3].map((n) => gate(async () => void order.push(n)))
    await Promise.all(runs)
    expect(order).toEqual([1, 2, 3])
  })

  it('gives each caller its own result', async () => {
    const gate = createLimiter(2)
    expect(await Promise.all([gate(async () => 'a'), gate(async () => 'b')])).toEqual(['a', 'b'])
  })

  it('does not wedge on a task that throws, and the throw reaches its caller', async () => {
    const gate = createLimiter(1)
    const failed = gate(async () => {
      throw new Error('boom')
    })
    await expect(failed).rejects.toThrow('boom')
    // The slot has to come back, or one bad file stops every later arrival.
    await expect(gate(async () => 'after')).resolves.toBe('after')
  })

  it('survives a task that throws before it ever awaits', async () => {
    const gate = createLimiter(1)
    await expect(
      gate(() => {
        throw new Error('sync')
      }),
    ).rejects.toThrow('sync')
    await expect(gate(async () => 'still running')).resolves.toBe('still running')
  })

  it('treats a nonsense cap as one, rather than never starting anything', async () => {
    expect(await createLimiter(0)(async () => 'ran')).toBe('ran')
  })
})
