import { DEFAULT_HOLD, LEVELS, type Attention, type Level } from '@shared/attention.ts'

/** A flag the wall never received. The same two fields a real one arrives as,
 *  so everything downstream of the merge reads it without a branch. */
export type FakeFlag = { attention: Attention; note: string }

/** Test cases, so the notes read like the ones an agent writes rather than
 *  like "urgent 1". Cycled per level. */
const NOTES: Record<Level, readonly string[]> = {
  look: ['hatch angle looks off', 'color drifted a stop', 'check the framing here'],
  soon: ['needs a read before the deadline', 'stale within the hour', 'reply wanted today'],
  urgent: ['render came out muddy', 'texture never promoted', 'wrong zone, moved twice'],
  problem: ['daemon dropped this frame', 'sidecar lost its caption', 'ingest wrote it twice'],
}

/**
 * Every attention level thrown across the wall at once. The badge collision it
 * produces is the point: two flagged artifacts near each other in one pile is
 * the case that cannot be waited for, so this manufactures it on demand.
 *
 * `rand` is a seam for the test and Math.random everywhere else.
 */
export function fakeFlags(
  ids: readonly string[],
  perLevel = 2,
  rand: () => number = Math.random,
): Record<string, FakeFlag> {
  const pool = [...ids]
  // Fisher-Yates, so the flags land on a different set each press and the same
  // pile can be hit twice running.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as string, pool[i] as string]
  }

  const out: Record<string, FakeFlag> = {}
  const take = Math.min(pool.length, perLevel * LEVELS.length)
  for (let i = 0; i < take; i++) {
    // Level-first rather than a run per level: a wall holding three artifacts
    // still shows three treatments, which is what the panel is for.
    const level = LEVELS[i % LEVELS.length] as Level
    const notes = NOTES[level]
    out[pool[i] as string] = {
      attention: { level, holdMs: DEFAULT_HOLD[level] },
      note: notes[Math.floor(i / LEVELS.length) % notes.length] as string,
    }
  }
  return out
}
