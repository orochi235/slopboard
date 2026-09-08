# Wheel Throttle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One physical scroll gesture buys one transition, so a hard flick can no longer carry the view from the top level into full magnification inside an image.

**Architecture:** A shared quiet gate answers "does this wheel event begin a new gesture?" by reading the gap since the previous event. `createGestureRail` uses it to clear a spend-lock set on every rung it fires, replacing the `cooldownMs` dead time that a momentum tail outlives. `ImageLightbox` uses the same gate to stay disarmed until the flick that opened it has stopped delivering.

**Tech Stack:** TypeScript, React, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-08-wheel-throttle-design.md`

---

### Task 1: The quiet gate

The one primitive both surfaces need. It lives under `src/nav/` because that is
where the wheel vocabulary already is, and it is pure so it can be tested — the
repo's vitest `include` is `{src,server,shared}/**/*.test.ts`, so nothing in a
`.tsx` file is reachable by a unit test.

**Files:**
- Create: `src/nav/quiet.ts`
- Test: `src/nav/quiet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/nav/quiet.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createQuietGate } from '@/nav/quiet.ts'

describe('createQuietGate', () => {
  it('calls the first event a fresh gesture', () => {
    const gate = createQuietGate(150)
    expect(gate.feed(0)).toBe(true)
  })

  it('calls a frame-interval stream one gesture', () => {
    const gate = createQuietGate(150)
    gate.feed(0)
    for (let t = 16; t <= 800; t += 16) expect(gate.feed(t)).toBe(false)
  })

  it('starts a new gesture once the stream goes quiet', () => {
    const gate = createQuietGate(150)
    gate.feed(0)
    expect(gate.feed(100)).toBe(false)
    expect(gate.feed(300)).toBe(true)
  })

  it('measures the gap from the last event, not the last fresh one', () => {
    const gate = createQuietGate(150)
    gate.feed(0)
    // 140 apart each: never quiet, however long the stream runs.
    for (let t = 140; t <= 1400; t += 140) expect(gate.feed(t)).toBe(false)
  })

  it('starts disarmed when handed a start time, for a mid-gesture mount', () => {
    const gate = createQuietGate(150, 1000)
    expect(gate.feed(1020)).toBe(false)
    expect(gate.feed(1400)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/nav/quiet.test.ts`
Expected: FAIL — cannot resolve `@/nav/quiet.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/nav/quiet.ts`:

```ts
/**
 * Whether a wheel event begins a new gesture or continues the one before it,
 * read off the gap since the previous event.
 *
 * A gap is the only signal that separates a hand from its momentum: a tail
 * delivers at frame intervals for most of a second and never opens one, and no
 * fixed dead time is both longer than the longest tail and shorter than the
 * pause between two deliberate pushes.
 *
 * `startedAt` is for a consumer that comes into existence mid-gesture and must
 * not treat the tail already in flight as a push of its own.
 */
export function createQuietGate(quietMs: number, startedAt = Number.NEGATIVE_INFINITY) {
  let lastAt = startedAt
  return {
    feed(now: number): boolean {
      const fresh = now - lastAt >= quietMs
      lastAt = now
      return fresh
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/nav/quiet.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/nav/quiet.ts src/nav/quiet.test.ts
git commit -m "add a quiet gate that separates a gesture from its momentum"
```

---

### Task 2: The rail spends a gesture per rung

**Files:**
- Modify: `src/nav/gesture.ts`
- Test: `src/nav/gesture.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/nav/gesture.test.ts`, change the options constant at the top from

```ts
const OPTS = { wheelThreshold: 60, pinchThreshold: 8, cooldownMs: 300 }
```

to

```ts
const OPTS = { wheelThreshold: 60, pinchThreshold: 8, quietMs: 150 }
```

Rename the test `'banks nothing during the cooldown, so the tail does not fire the moment it lapses'` to `'banks nothing behind a spent gesture, however long the tail runs'`, and the test `'fires again for a deliberate second gesture after the cooldown'` to `'fires again for a deliberate second gesture after the stream goes quiet'`. Leave both bodies alone — they already describe the new behavior and pass under it.

Then add these three tests inside the `describe` block:

```ts
  it('gives a hard flick one rung and no more', () => {
    const rail = createGestureRail(OPTS)
    let fired = 0
    // 50 frames of a decaying throw, which under a time-based cooldown was
    // worth a rung every time the dead time lapsed.
    for (let i = 0; i < 50; i++) if (rail.feed(wheel(-120), i * 16)) fired++
    expect(fired).toBe(1)
  })

  it('does not let a spent gesture buy a step by reversing', () => {
    const rail = createGestureRail(OPTS)
    expect(rail.feed(wheel(-70), 0)).toBe('in')
    expect(rail.feed(wheel(90), 16)).toBeNull()
    expect(rail.feed(wheel(90), 32)).toBeNull()
  })

  it('gives the next flick its own rung once the hand stops', () => {
    const rail = createGestureRail(OPTS)
    let fired = 0
    for (let i = 0; i < 20; i++) if (rail.feed(wheel(-120), i * 16)) fired++
    for (let i = 0; i < 20; i++) if (rail.feed(wheel(-120), 1000 + i * 16)) fired++
    expect(fired).toBe(2)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/nav/gesture.test.ts`
Expected: FAIL — `quietMs` is not a `RailOptions` key (type error), and the three new tests fail because the rail still fires off the tail.

- [ ] **Step 3: Write the implementation**

Replace the whole body of `src/nav/gesture.ts` below the `WheelSample` type with:

```ts
export type RailOptions = {
  /** Charge a scroll must accumulate to move a rung. */
  wheelThreshold: number
  /** The same for a pinch, whose deltas run an order of magnitude smaller. */
  pinchThreshold: number
  /** A gap this long ends a gesture and unlocks the rail. */
  quietMs: number
}

/**
 * Turns a stream of wheel samples into discrete rungs, at most one per
 * gesture. The charge is unsigned and thrown away whenever the direction or
 * the input device changes, so a reversal starts a gesture rather than paying
 * off the last one, and a pinch never inherits a scroll's charge.
 */
export function createGestureRail(opts: RailOptions) {
  let charge = 0
  let towards: Step | null = null
  let pinching = false
  let spent = false
  const gate = createQuietGate(opts.quietMs)

  return {
    feed(sample: WheelSample, now: number): Step | null {
      if (sample.deltaY === 0) return null
      if (gate.feed(now)) {
        spent = false
        charge = 0
      }
      // Zeroed rather than merely ignored: a tail allowed to bank would fire
      // the instant the gesture ended, from a throw the hand had finished.
      if (spent) {
        charge = 0
        return null
      }

      // Scrolling away and spreading two fingers both mean inward, which is the
      // direction every map on this machine already agrees on.
      const direction: Step = sample.deltaY < 0 ? 'in' : 'out'
      if (direction !== towards || sample.ctrlKey !== pinching) charge = 0
      towards = direction
      pinching = sample.ctrlKey

      charge += Math.abs(sample.deltaY)
      const threshold = pinching ? opts.pinchThreshold : opts.wheelThreshold
      if (charge < threshold) return null

      charge = 0
      spent = true
      return direction
    },
  }
}
```

Add the import at the top of the file, below the existing header comment:

```ts
import { createQuietGate } from '@/nav/quiet.ts'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/nav/gesture.test.ts`
Expected: PASS — the 11 existing tests plus the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/nav/gesture.ts src/nav/gesture.test.ts
git commit -m "spend a gesture per rung instead of serving a dead time"
```

---

### Task 3: `nav.cooldownMs` becomes `nav.quietMs`

No storage migration. `mergeStored` in `src/params.store.ts` keeps only keys the
defaults still have, so a stored `cooldownMs` is dropped on load and the new
`quietMs` default wins.

**Files:**
- Modify: `src/params.ts:170` (the type) and `src/params.ts:430` (the default)
- Modify: `src/params.controls.ts:73`

- [ ] **Step 1: Rename the field on the type**

In `src/params.ts`, inside the `nav` block, replace

```ts
    /** Dead time after a step. Momentum scrolling keeps delivering for most of
     *  a second, and without this one flick walks the whole hierarchy. */
    cooldownMs: number
```

with

```ts
    /** A silence this long ends a wheel gesture. One gesture is worth one rung,
     *  so a flick's tail cannot walk the hierarchy behind the hand. */
    quietMs: number
```

- [ ] **Step 2: Rename the default**

In `src/params.ts`, in the `nav` defaults, replace `cooldownMs: 320,` with `quietMs: 150,`.

- [ ] **Step 3: Rename the slider**

In `src/params.controls.ts`, replace `'nav.cooldownMs': [0, 1200, 10],` with `'nav.quietMs': [0, 600, 10],`.

- [ ] **Step 4: Verify nothing still names the old field**

Run: `git grep -n cooldownMs`
Expected: no output.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/params.ts src/params.controls.ts
git commit -m "trade the nav cooldown slider for a quiet-gap one"
```

---

### Task 4: The lightbox refuses the tail that opened it

`ImageLightbox` mounts while the flick that selected the card is still
delivering. It takes the same `quietMs` and stays disarmed until it sees a gap.

Not unit-testable here: vitest's `include` covers `.ts` only, so there is no
component test in this repo and no e2e directory. The gate's behavior is
covered by Task 1; this task is wiring, checked by typecheck and by hand.

**Files:**
- Modify: `src/Lightbox.tsx`
- Modify: `src/backends/WebglBackend.tsx:1532`

- [ ] **Step 1: Import the gate**

In `src/Lightbox.tsx`, add to the imports:

```ts
import { createQuietGate } from '@/nav/quiet.ts'
```

- [ ] **Step 2: Take `quietMs` on `ImageLightbox`**

Change the `ImageLightbox` signature from

```tsx
function ImageLightbox({
  item,
  now,
  onClose,
}: {
  item: WallItem
  now: number
  onClose: () => void
}) {
```

to

```tsx
function ImageLightbox({
  item,
  now,
  quietMs,
  onClose,
}: {
  item: WallItem
  now: number
  quietMs: number
  onClose: () => void
}) {
```

- [ ] **Step 3: Add the armed ref**

Beside the other refs in `ImageLightbox` (under `const drag = useRef<...>(null)`), add:

```tsx
  /** False until the wheel stream has gone quiet once. The flick that opened
   *  this image is still arriving, and it has already been paid for. */
  const armed = useRef(false)
```

- [ ] **Step 4: Gate the wheel handler**

Replace the wheel effect in `ImageLightbox` with:

```tsx
  useEffect(() => {
    const el = port.current
    if (!el) return
    // `timeStamp` on a wheel event and `performance.now()` share the document's
    // time origin, so the mount time is a gap the tail cannot open.
    const gate = createQuietGate(quietMs, performance.now())
    const onWheel = (e: WheelEvent) => {
      if (!el.contains(document.activeElement)) return
      e.preventDefault()
      // Swallowed even while disarmed: left to propagate, the tail reaches the
      // wall's window listener and steps a rung back out from under the image
      // that just opened.
      e.stopPropagation()
      if (gate.feed(e.timeStamp)) armed.current = true
      if (!armed.current) return
      setEased(false)
      setView((v) => zoomByWheel(v, e.deltaY, { x: e.clientX, y: e.clientY }, image, size.current))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [image, quietMs])
```

Leave the comment block above the effect where it is.

- [ ] **Step 5: Pass it through the dispatcher**

Replace the exported `Lightbox` at the bottom of `src/Lightbox.tsx` with:

```tsx
export function Lightbox(props: {
  item: WallItem
  now: number
  quietMs: number
  onClose: () => void
}) {
  const { quietMs, ...rest } = props
  return rest.item.kind === 'page' ? (
    <PageLightbox {...rest} />
  ) : (
    <ImageLightbox {...rest} quietMs={quietMs} />
  )
}
```

- [ ] **Step 6: Hand it the param**

In `src/backends/WebglBackend.tsx`, replace

```tsx
      {lit && <Lightbox item={lit} now={now} onClose={() => dispatch({ type: 'out' })} />}
```

with

```tsx
      {lit && (
        <Lightbox
          item={lit}
          now={now}
          quietMs={params.nav.quietMs}
          onClose={() => dispatch({ type: 'out' })}
        />
      )}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Check by hand**

Run: `npm run dev`, then in the browser:

1. From the top-level view, throw one hard flick inward. Expected: the view moves one rung and stops, with the rest of the momentum ignored.
2. Push again deliberately. Expected: one more rung.
3. Descend to a card so the lightbox opens, throwing the flick that opens it hard. Expected: the image arrives fitted and stays fitted — the tail does not zoom it, and does not close it either.
4. Scroll again after a pause. Expected: smooth continuous zoom, reaching full magnification in one push if you keep going.
5. Open the params panel, `nav` group. Expected: a `quietMs` slider where `cooldownMs` was.

- [ ] **Step 9: Commit**

```bash
git add src/Lightbox.tsx src/backends/WebglBackend.tsx
git commit -m "disarm the lightbox zoom until the opening flick has stopped"
```

---

### Task 5: Mark the spec built

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-wheel-throttle-design.md:3`

- [ ] **Step 1: Replace the status line**

Change the opening line from

```markdown
**Unbuilt.** For whoever implements it, or wonders later why the rail is shaped
this way.
```

to

```markdown
For whoever wonders later why the rail is shaped this way.
```

- [ ] **Step 2: Run the tests that cover the change**

Run: `npx vitest run src/nav/`
Expected: PASS. Not the full suite — nothing outside `src/nav/` and the two wired files was touched.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-08-wheel-throttle-design.md
git commit -m "mark the wheel throttle built"
```
