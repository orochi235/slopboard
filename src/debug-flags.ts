import { DEFAULT_HOLD, LEVELS, type Attention, type Level } from '@shared/attention.ts'

/** A flag the wall never received. The same two fields a real one arrives as,
 *  so everything downstream of the merge reads it without a branch. */
export type FakeFlag = { attention: Attention; note: string }

/**
 * Deliberately absurd, and that is the point: a badge reading "the pixels have
 * unionized" is one nobody mistakes for a real flag, so a wall full of these
 * can never be misread as the wall actually asking for something. Length is
 * the other constraint — these render as badge text, so they stay short enough
 * to read at wall distance.
 */
const NOTES: Record<Level, readonly string[]> = {
  look: [
    'the hatching has opinions',
    'this one is smug about something',
    'slightly too many horses',
    'the vanishing point wandered off',
    'looks like it knows what it did',
    'the light source is lying',
    'somebody drew a hand. bold.',
    'this shade of blue owes me money',
    'composition fine, vibes not',
    'the gradient is doing a little dance',
  ],
  soon: [
    'perishable, like a fish',
    'will be embarrassing by Thursday',
    'the deadline has started making eye contact',
    'expires when the coffee does',
    'aging poorly, like a lettuce',
    'goes stale faster than the milk',
    'somebody promised this to somebody',
    'the window is closing and it is a small window',
    'becomes another persons problem at five',
    'the clock is doing that thing again',
  ],
  urgent: [
    'the render is on fire and so am I',
    'this one bit the daemon',
    'texture achieved sentience, then quit',
    'seventeen layers and none of them agree',
    'it rendered wrong on purpose',
    'the pixels have unionized',
    'the GPU made a noise it should not make',
    'this broke containment',
    'the alpha channel filed a complaint',
    'the mesh is inside out and proud',
  ],
  problem: [
    'daemon saw this and lay down',
    'sidecar ate the caption and left',
    'ingested twice, regrets both',
    'this file is haunted, respectfully',
    'wrote itself into the trash and back',
    'the zone rejected it on principle',
    'chokidar witnessed something',
    'this image has no business existing',
    'metadata says it was made in 1987',
    'the wall refuses to hold this one',
  ],
}

/**
 * Every attention level thrown across the wall at once. The badge collision it
 * produces is the point: two flagged artifacts near each other in one pile is
 * the case that cannot be waited for, so this manufactures it on demand.
 *
 * A level's hold runs from the card's birth, because a real flag arrives with
 * the card. A fake one lands on a card that is already old, so its hold is
 * stretched by that age — otherwise `soon`, the one level that lapses, would
 * be born lapsed on any card older than half an hour and never wear a plate.
 * `now` is the daemon's clock, the one `bornAt` is on.
 *
 * `rand` is a seam for the test and Math.random everywhere else.
 */
export function fakeFlags(
  items: readonly { id: string; bornAt: number }[],
  now: number,
  perLevel = 2,
  rand: () => number = Math.random,
): Record<string, FakeFlag> {
  const age = new Map(items.map((i) => [i.id, Math.max(0, now - i.bornAt)]))
  const pool = items.map((i) => i.id)
  // Fisher-Yates, so the flags land on a different set each press and the same
  // pile can be hit twice running.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as string, pool[i] as string]
  }

  const out: Record<string, FakeFlag> = {}
  const take = Math.min(pool.length, perLevel * LEVELS.length)

  // Shuffled per level and drawn without replacement, so two `urgent` flags in
  // one press never read the same and a second press reads differently. Cycling
  // by index instead would only ever reach the first `perLevel` notes — two of
  // them, at the default — however many are written.
  const unread = new Map<Level, string[]>()
  for (const level of LEVELS) {
    const notes = [...NOTES[level]]
    for (let i = notes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[notes[i], notes[j]] = [notes[j] as string, notes[i] as string]
    }
    unread.set(level, notes)
  }
  const drawn = new Map<Level, number>()

  for (let i = 0; i < take; i++) {
    // Level-first rather than a run per level: a wall holding three artifacts
    // still shows three treatments, which is what the panel is for.
    const level = LEVELS[i % LEVELS.length] as Level
    const notes = unread.get(level) as string[]
    const n = drawn.get(level) ?? 0
    drawn.set(level, n + 1)
    const id = pool[i] as string
    const hold = DEFAULT_HOLD[level]
    out[id] = {
      attention: { level, holdMs: hold === null ? null : hold + (age.get(id) ?? 0) },
      note: notes[n % notes.length] as string,
    }
  }
  return out
}
