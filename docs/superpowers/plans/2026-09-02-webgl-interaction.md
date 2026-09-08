# Wall Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wall answerable — click a pile to fill the frame with it, walk to its neighbours, open one image at full resolution, and get back out.

**Architecture:** The wall answers "which repos are producing"; this plan builds the path to "what did it make." Three states — wall, stack, lightbox — and every question with a right answer is a pure function tested with no GL context: where the camera sits to frame a cell, how far along an eased move it is at time `t`, which zone an arrow key reaches, and what Escape means from each state. The r3f wiring is a raycast and a `useFrame` that reads the camera pose those functions return.

**Tech Stack:** three, @react-three/fiber, React 19, vitest.

---

## Scope: this is plan 3 of 3

1. ~~**Layout layer**~~ — done, on `main`.
2. **Renderer** — see `2026-09-02-webgl-renderer.md`. This plan assumes the wall draws.
3. **Interaction (this plan)** — camera levels, pointer raycast, arrow navigation, Escape, the DOM lightbox.

## Global Constraints

Same as plans 1 and 2: `.ts`/`.tsx` import extensions, `@/*` and `@shared/*` aliases, windease from the source alias, world units where z = 0 has visible height 1.0, and every tunable number in `StackParams` rather than in a component.

One more, specific to this plan: **the camera is view state, owned by neither the arrangement nor a constant.** An arrangement supplies a default camera and never moves it. Nothing below writes to `params.ts` at runtime.

---

### Task 1: Where the camera sits to frame a box

Zooming to a pile means framing its grid cell. That is trigonometry with one
right answer, so it is a function rather than something tuned by hand: a
perspective camera at `fovDeg` sees a box of height `h` when it sits
`h / 2 / tan(fov/2)` away, and a wide box is bounded by width against the
viewport aspect instead.

**Files:**
- Create: `src/camera/frame.ts`
- Create: `src/camera/frame.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/camera/frame.test.ts
import { describe, expect, it } from 'vitest'
import { framePose } from '@/camera/frame.ts'

const FOV = 35
// The z that makes visible height exactly 1.0 — the plane the 2D wall sits on.
const UNIT_Z = 0.5 / Math.tan((FOV * Math.PI) / 360)

describe('framePose', () => {
  it('reproduces the unit plane when framing a 1.0-high box at aspect 1', () => {
    const pose = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(pose.z).toBeCloseTo(UNIT_Z, 6)
  })

  it('centres on the box rather than the origin', () => {
    const pose = framePose({ x: 2, y: 4, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(pose.x).toBeCloseTo(2.5, 6)
    expect(pose.y).toBeCloseTo(4.5, 6)
  })

  it('moves closer for a smaller box', () => {
    const big = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    const small = framePose({ x: 0, y: 0, w: 0.25, h: 0.25 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    expect(small.z).toBeLessThan(big.z)
    expect(small.z).toBeCloseTo(big.z / 4, 6)
  })

  it('pulls back for a box wider than the viewport can hold at that height', () => {
    const square = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    const wide = framePose({ x: 0, y: 0, w: 4, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    // Height alone would give the same z; width is what binds here.
    expect(wide.z).toBeGreaterThan(square.z)
  })

  it('does not pull back for width the viewport already covers', () => {
    const pose = framePose({ x: 0, y: 0, w: 2, h: 1 }, { fovDeg: FOV, aspect: 4, margin: 1 })
    expect(pose.z).toBeCloseTo(UNIT_Z, 6)
  })

  it('applies margin as slack around the box', () => {
    const tight = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1 })
    const loose = framePose({ x: 0, y: 0, w: 1, h: 1 }, { fovDeg: FOV, aspect: 1, margin: 1.2 })
    expect(loose.z).toBeCloseTo(tight.z * 1.2, 6)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/camera/frame.test.ts`
Expected: FAIL — "Failed to resolve import @/camera/frame.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/camera/frame.ts
import type { Rect } from 'windease'

/** Where the camera sits and what it looks at. Looking straight down -Z, so a
 *  pose is three numbers rather than a full transform. */
export type Pose = { x: number; y: number; z: number }

/**
 * The distance that fits `box` in frame. Height sets it, unless the box is
 * wider than the viewport covers at that distance — then width binds and the
 * camera pulls back.
 */
export function framePose(
  box: Pick<Rect, 'x' | 'y' | 'w' | 'h'>,
  view: { fovDeg: number; aspect: number; margin: number },
): Pose {
  const halfFov = (view.fovDeg * Math.PI) / 360
  const forHeight = box.h / 2 / Math.tan(halfFov)
  const forWidth = box.w / view.aspect / 2 / Math.tan(halfFov)
  return {
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
    z: Math.max(forHeight, forWidth) * view.margin,
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/camera/frame.test.ts`
Expected: PASS, 6 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/camera/frame.ts src/camera/frame.test.ts
git commit -m "compute the camera pose that frames a box"
```

---

### Task 2: Easing between two poses

The camera move has to be closed-form in `now` for the same reason every other
motion here is: the frame loop recomputes from state rather than integrating,
so a dropped frame costs nothing and a re-render mid-move does not restart it.

**Files:**
- Create: `src/camera/move.ts`
- Create: `src/camera/move.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/camera/move.test.ts
import { describe, expect, it } from 'vitest'
import { poseAt } from '@/camera/move.ts'

const from = { x: 0, y: 0, z: 4 }
const to = { x: 2, y: 1, z: 1 }
const move = { from, to, startedAt: 1000, durationMs: 400 }

describe('poseAt', () => {
  it('is exactly the start pose before the move begins', () => {
    expect(poseAt(move, 1000)).toEqual(from)
  })

  it('is exactly the end pose once the duration has elapsed', () => {
    expect(poseAt(move, 1400)).toEqual(to)
  })

  it('stays at the end pose afterwards rather than overshooting', () => {
    expect(poseAt(move, 99_999)).toEqual(to)
  })

  it('is monotonic on every axis through the move', () => {
    const samples = [0, 100, 200, 300, 400].map((dt) => poseAt(move, 1000 + dt))
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.x).toBeGreaterThanOrEqual(samples[i - 1]!.x)
      expect(samples[i]!.z).toBeLessThanOrEqual(samples[i - 1]!.z)
    }
  })

  it('eases out — past halfway by the time it is halfway through', () => {
    const mid = poseAt(move, 1200)
    expect(mid.x).toBeGreaterThan(1)
  })

  it('is a jump cut at zero duration rather than a divide by zero', () => {
    expect(poseAt({ ...move, durationMs: 0 }, 1000)).toEqual(to)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/camera/move.test.ts`
Expected: FAIL — "Failed to resolve import @/camera/move.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/camera/move.ts
import type { Pose } from '@/camera/frame.ts'

export type Move = { from: Pose; to: Pose; startedAt: number; durationMs: number }

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Closed-form in `now`: a dropped frame costs nothing and a re-render
 *  mid-move does not restart it. */
export function poseAt(move: Move, now: number): Pose {
  if (move.durationMs <= 0) return move.to
  const t = Math.max(0, Math.min(1, (now - move.startedAt) / move.durationMs))
  const k = easeOut(t)
  return {
    x: move.from.x + (move.to.x - move.from.x) * k,
    y: move.from.y + (move.to.y - move.from.y) * k,
    z: move.from.z + (move.to.z - move.from.z) * k,
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/camera/move.test.ts`
Expected: PASS, 6 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/camera/move.ts src/camera/move.test.ts
git commit -m "ease the camera between poses as a function of now"
```

---

### Task 3: Arrow navigation across the zone grid

The spec's estimate: "Arrow keys across a known grid is ~20 lines." It is,
because the cells are already known — `createZoneGrid` returns them. Resolve
geometrically against those rects rather than against a remembered row/column,
so a zone arriving and re-tiling the wall cannot desync the cursor.

**Files:**
- Create: `src/nav/neighbour.ts`
- Create: `src/nav/neighbour.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/nav/neighbour.test.ts
import { describe, expect, it } from 'vitest'
import { neighbourOf } from '@/nav/neighbour.ts'
import type { Rect } from 'windease'

// A 3x2 grid of unit cells, named by position.
const cells = new Map<string, Rect>([
  ['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }],
  ['b', { x: 1, y: 0, z: 0, w: 1, h: 1 }],
  ['c', { x: 2, y: 0, z: 0, w: 1, h: 1 }],
  ['d', { x: 0, y: 1, z: 0, w: 1, h: 1 }],
  ['e', { x: 1, y: 1, z: 0, w: 1, h: 1 }],
  ['f', { x: 2, y: 1, z: 0, w: 1, h: 1 }],
])

describe('neighbourOf', () => {
  it('walks along a row', () => {
    expect(neighbourOf(cells, 'a', 'right')).toBe('b')
    expect(neighbourOf(cells, 'b', 'left')).toBe('a')
  })

  it('walks down a column', () => {
    expect(neighbourOf(cells, 'b', 'down')).toBe('e')
    expect(neighbourOf(cells, 'e', 'up')).toBe('b')
  })

  it('stops at an edge rather than wrapping', () => {
    expect(neighbourOf(cells, 'c', 'right')).toBeNull()
    expect(neighbourOf(cells, 'a', 'up')).toBeNull()
  })

  it('prefers the cell straight ahead over a nearer one off to the side', () => {
    // 'd' is directly below 'a'; 'b' is nearer by raw distance but sideways.
    expect(neighbourOf(cells, 'a', 'down')).toBe('d')
  })

  it('answers null for a zone that is no longer on the wall', () => {
    expect(neighbourOf(cells, 'gone', 'right')).toBeNull()
  })

  it('answers null when it is the only zone', () => {
    const one = new Map<string, Rect>([['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }]])
    expect(neighbourOf(one, 'a', 'left')).toBeNull()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/nav/neighbour.test.ts`
Expected: FAIL — "Failed to resolve import @/nav/neighbour.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/nav/neighbour.ts
import type { Rect } from 'windease'

export type Direction = 'left' | 'right' | 'up' | 'down'

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** Drift off the axis costs more than distance along it, so a cell straight
 *  ahead beats a nearer one to the side. */
const CROSS_PENALTY = 3

/**
 * Resolved against the cells themselves rather than a remembered row/column, so
 * a zone arriving and re-tiling the wall cannot desync the cursor.
 */
export function neighbourOf(
  cells: ReadonlyMap<string, Rect>,
  from: string,
  direction: Direction,
): string | null {
  const source = cells.get(from)
  if (!source) return null
  const origin = centre(source)

  let best: { id: string; score: number } | null = null
  for (const [id, rect] of cells) {
    if (id === from) continue
    const c = centre(rect)
    const dx = c.x - origin.x
    const dy = c.y - origin.y

    let along: number
    let across: number
    if (direction === 'left') {
      if (dx >= 0) continue
      along = -dx
      across = Math.abs(dy)
    } else if (direction === 'right') {
      if (dx <= 0) continue
      along = dx
      across = Math.abs(dy)
    } else if (direction === 'up') {
      if (dy >= 0) continue
      along = -dy
      across = Math.abs(dx)
    } else {
      if (dy <= 0) continue
      along = dy
      across = Math.abs(dx)
    }

    const score = along + CROSS_PENALTY * across
    if (!best || score < best.score) best = { id, score }
  }
  return best ? best.id : null
}
```

Note the y convention: windease rects grow downward from the container's
top-left, and `createZoneGrid` returns them in that space, so `'down'` is
increasing y. The renderer flips y once when it converts a rect to a world
position; navigation stays in rect space and never sees the flip.

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/nav/neighbour.test.ts`
Expected: PASS, 6 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/nav/neighbour.ts src/nav/neighbour.test.ts
git commit -m "resolve arrow navigation against the zone cells themselves"
```

---

### Task 4: The view state machine

Three states, and the only interesting question is what Escape means from each.
Worth a tested reducer rather than three `useState`s, because "Escape from the
lightbox returns to the stack, not to the wall" is a rule someone will otherwise
get wrong while wiring a keydown handler.

**Files:**
- Create: `src/view-state.ts`
- Create: `src/view-state.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/view-state.test.ts
import { describe, expect, it } from 'vitest'
import { type ViewState, reduceView, WALL } from '@/view-state.ts'

describe('reduceView', () => {
  it('starts at the wall', () => {
    expect(WALL).toEqual({ kind: 'wall' })
  })

  it('zooms from the wall to a pile', () => {
    expect(reduceView(WALL, { type: 'zoom', zone: 'windease' })).toEqual({
      kind: 'stack',
      zone: 'windease',
    })
  })

  it('walks between piles without going back to the wall', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'zoom', zone: 'slopboard' })).toEqual({
      kind: 'stack',
      zone: 'slopboard',
    })
  })

  it('opens the lightbox from a pile, remembering which pile', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'open', id: 'img-1' })).toEqual({
      kind: 'lightbox',
      zone: 'windease',
      id: 'img-1',
    })
  })

  it('escapes the lightbox back to its pile, not to the wall', () => {
    const at: ViewState = { kind: 'lightbox', zone: 'windease', id: 'img-1' }
    expect(reduceView(at, { type: 'escape' })).toEqual({ kind: 'stack', zone: 'windease' })
  })

  it('escapes a pile back to the wall', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'escape' })).toEqual(WALL)
  })

  it('escapes the wall to nothing — there is nowhere further out', () => {
    expect(reduceView(WALL, { type: 'escape' })).toEqual(WALL)
  })

  it('refuses to open the lightbox from the wall, where no image is addressed', () => {
    expect(reduceView(WALL, { type: 'open', id: 'img-1' })).toEqual(WALL)
  })

  it('drops back to the wall when the zone it is showing leaves', () => {
    const at: ViewState = { kind: 'stack', zone: 'gone' }
    expect(reduceView(at, { type: 'zones', live: ['windease'] })).toEqual(WALL)
  })

  it('keeps its place when the zone it is showing is still live', () => {
    const at: ViewState = { kind: 'stack', zone: 'windease' }
    expect(reduceView(at, { type: 'zones', live: ['windease', 'slopboard'] })).toEqual(at)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/view-state.test.ts`
Expected: FAIL — "Failed to resolve import @/view-state.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/view-state.ts
export type ViewState =
  | { kind: 'wall' }
  | { kind: 'stack'; zone: string }
  | { kind: 'lightbox'; zone: string; id: string }

export type ViewAction =
  | { type: 'zoom'; zone: string }
  | { type: 'open'; id: string }
  | { type: 'escape' }
  /** The daemon owns item lifetime, so a zone can vanish under the camera. */
  | { type: 'zones'; live: readonly string[] }

export const WALL: ViewState = { kind: 'wall' }

export function reduceView(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'zoom':
      return { kind: 'stack', zone: action.zone }
    case 'open':
      return state.kind === 'wall' ? state : { kind: 'lightbox', zone: state.zone, id: action.id }
    case 'escape':
      if (state.kind === 'lightbox') return { kind: 'stack', zone: state.zone }
      if (state.kind === 'stack') return WALL
      return state
    case 'zones':
      if (state.kind === 'wall') return state
      return action.live.includes(state.zone) ? state : WALL
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/view-state.test.ts`
Expected: PASS, 10 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/view-state.ts src/view-state.test.ts
git commit -m "reduce the wall, stack and lightbox to one view state"
```

---

### Task 5: The lightbox

A DOM overlay over the canvas, serving `/orig/:id`. Full resolution is the one
thing it is for and the one thing a texture cannot afford — a 6000×4000 render
is 96 MB as RGBA in VRAM against a browser `<img>` that costs the GL budget
nothing, and it keeps right-click-save, copy, drag-to-Finder and true 1:1.

**Files:**
- Create: `src/Lightbox.tsx`
- Create: `src/lightbox.css`

- [x] **Step 1: Write the component**

```tsx
// src/Lightbox.tsx
import { useEffect, useState } from 'react'
import './lightbox.css'

/**
 * A DOM overlay, not a GL quad: full resolution costs the texture budget
 * nothing here, and right-click-save, copy and drag-to-Finder keep working.
 */
export function Lightbox({ id, onClose }: { id: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)

  // The id changes when the viewer moves between images without closing.
  useEffect(() => setLoaded(false), [id])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Full resolution image"
      onClick={onClose}
    >
      <img
        className={`lightbox__img ${loaded ? 'lightbox__img--in' : ''}`}
        src={`/orig/${id}`}
        alt=""
        onLoad={() => setLoaded(true)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
```

- [x] **Step 2: Write the stylesheet**

```css
/* src/lightbox.css */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.86);
  cursor: zoom-out;
}

.lightbox__img {
  max-width: 94vw;
  max-height: 94vh;
  cursor: default;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.lightbox__img--in {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .lightbox__img {
    transition: none;
  }
}
```

- [x] **Step 3: Typecheck**

Run: `cd ~/src/slopboard && npm run typecheck`
Expected: clean.

- [x] **Step 4: Commit**

```bash
cd ~/src/slopboard
git add src/Lightbox.tsx src/lightbox.css
git commit -m "show one image at full resolution in a DOM overlay"
```

---

### Task 6: Wire the camera, the raycast and the keys

**Eyes only** for the raycast; the state and the poses underneath it are all
tested by tasks 1–4.

**Files:**
- Modify: `src/backends/WebglBackend.tsx`
- Modify: `src/params.ts`

- [x] **Step 1: Add the two camera levels to the parameter surface**

In `src/params.ts`, extend the `camera` field of `StackParams`:

```ts
  camera: {
    fovDeg: number
    /** Slack around the framed box at each level. 1 is exactly framed. */
    wallMargin: number
    stackMargin: number
    /** How long a level change takes. */
    moveMs: number
  }
```

and the matching default:

```ts
  camera: { fovDeg: 35, wallMargin: 1.08, stackMargin: 1.12, moveMs: 520 },
```

- [x] **Step 2: Track the pose in the frame loop**

Inside `Wall` in `src/backends/WebglBackend.tsx`, add the view state, the cells
the last layout produced, and a move that the frame loop reads:

```tsx
  const [view, dispatch] = useReducer(reduceView, WALL)
  const cells = useRef<Map<string, Rect>>(new Map())
  const move = useRef<Move | null>(null)
  const pose = useRef<Pose>({ x: 0, y: 0, z: 1.586 })

  // A level change starts a move from wherever the camera is right now, so an
  // interrupted zoom continues from its current pose rather than snapping.
  useEffect(() => {
    const aspect = window.innerWidth / window.innerHeight
    const box =
      view.kind === 'wall'
        ? { x: 0, y: 0, w: aspect, h: 1 }
        : (cells.current.get(view.zone) ?? { x: 0, y: 0, w: aspect, h: 1 })
    const margin =
      view.kind === 'wall' ? defaultParams.camera.wallMargin : defaultParams.camera.stackMargin

    move.current = {
      from: { ...pose.current },
      to: framePose(box, { fovDeg: defaultParams.camera.fovDeg, aspect, margin }),
      startedAt: performance.now(),
      durationMs: defaultParams.camera.moveMs,
    }
  }, [view])
```

and at the end of the existing `useFrame` callback, drive the camera:

```tsx
    if (move.current) pose.current = poseAt(move.current, performance.now())
    camera.position.set(pose.current.x, -pose.current.y, pose.current.z)
    camera.lookAt(pose.current.x, -pose.current.y, 0)
```

pulling `camera` from the same `useThree()` call that already provides `gl`.
The `-y` is the single flip between windease's downward-growing rect space and
three's upward-growing world; nothing else in this file negates y.

- [x] **Step 3: Record the cells and keep the view honest about live zones**

Still inside `useFrame`, after the layout call:

```tsx
    const zoneOf = new Map(model.map((m) => [m.id, m.zone]))
    zoneById.current = zoneOf
    cells.current = zoneCellsOf(result.placements, zoneOf)
```

where `zoneCellsOf` derives one bounding box per zone from the placements it
returned — the strategy does not publish its cells, and re-deriving them is
cheaper than changing its return type:

```tsx
/** One bounding box per zone, from the items placed in it. */
function zoneCellsOf(
  placements: ReadonlyMap<string, Rect>,
  zoneOf: ReadonlyMap<string, string>,
): Map<string, Rect> {
  const out = new Map<string, Rect>()
  for (const [id, r] of placements) {
    const zone = zoneOf.get(id)
    if (!zone) continue
    const seen = out.get(zone)
    if (!seen) {
      out.set(zone, { ...r })
      continue
    }
    const x = Math.min(seen.x, r.x)
    const y = Math.min(seen.y, r.y)
    out.set(zone, {
      x,
      y,
      z: 0,
      w: Math.max(seen.x + seen.w, r.x + r.w) - x,
      h: Math.max(seen.y + seen.h, r.y + r.h) - y,
    })
  }
  return out
}
```

That `zoneOf` map is also what Step 4's click handler reads, so it is built
once per frame and shared. Feed the live zone list to the reducer so a vanished
zone drops the camera back:

```tsx
    const live = [...new Set(model.map((m) => m.zone))]
    if (view.kind !== 'wall' && !live.includes(view.zone)) dispatch({ type: 'zones', live })
```

- [x] **Step 4: Pick a pile by raycast**

R3F puts a raycast behind `onClick` on any mesh, so picking needs no manual
`Raycaster`: give each card mesh the zone it belongs to and zoom on click.
Add to the mesh element in the `live.map(...)` body:

```tsx
          onClick={(e) => {
            e.stopPropagation()
            const zone = zoneById.current.get(id)
            if (view.kind === 'wall' && zone) dispatch({ type: 'zoom', zone })
            else if (view.kind === 'stack') dispatch({ type: 'open', id })
          }}
```

with `zoneById` a ref updated each frame from `model`. At wall level a click
means "zoom to this pile"; once zoomed it means "open this card," which is the
same primitive at two levels rather than two mechanisms.

- [x] **Step 5: Bind the keys**

In `Wall`, alongside the context-loss effect:

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return dispatch({ type: 'escape' })
      if (view.kind !== 'stack') return
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const
      const direction = map[e.key as keyof typeof map]
      if (!direction) return
      const next = neighbourOf(cells.current, view.zone, direction)
      if (next) dispatch({ type: 'zoom', zone: next })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])
```

Arrows only act at stack level: at wall level everything is already in frame,
and in the lightbox they belong to the image.

- [x] **Step 6: Mount the lightbox**

In `WebglBackend`, render the overlay beside the canvas rather than inside it —
`<Canvas>` children are scene graph nodes, and a DOM element there will not
mount. Lift `view` and `dispatch` to `WebglBackend`, pass them into `Wall`, and:

```tsx
      {view.kind === 'lightbox' && (
        <Lightbox id={view.id} onClose={() => dispatch({ type: 'escape' })} />
      )}
```

- [x] **Step 7: Typecheck and run the suite**

Run: `cd ~/src/slopboard && npm run typecheck && npx vitest run`
Expected: typecheck clean, every test passing.

- [x] **Step 8: Commit**

```bash
cd ~/src/slopboard
git add src/backends/WebglBackend.tsx src/params.ts
git commit -m "zoom to a pile, walk between piles, and open one card"
```

---

### Task 7: Look at it

**Closed 2026-09-07 without a tuning pass.** The owner's call: the defaults
stand, and a number changes when the wall looks wrong, not before.

- [x] **Step 1: Run the wall**

```bash
cd ~/src/slopboard
bin/wall stat   # both halves run under launchd
npm run sim -- --rate=2400 --zones=alpha,beta,gamma,delta,epsilon,zeta
```

Open `http://localhost:5183/`.

- [x] **Step 2: Walk the whole path**

Click a pile → it fills the frame. Arrow between piles → the camera moves
without returning to wall level. Click a card → full resolution. Escape →
back to the pile. Escape again → back to the wall.

- [x] **Step 3: Judge the two numbers this plan adds**

- Is the zoom fast enough to feel direct and slow enough to keep your place?
  (`camera.moveMs`)
- Is a framed pile too tight or swimming in space? (`camera.stackMargin`)

Two ways in arrived after this plan was written: the plan view in the top-left
zooms to a pile when clicked, and dragging the canvas turns the scene. Walk the
path through both.

- [x] **Step 4: Check the one thing tests cannot**

Let a zoomed pile sit until its zone expires entirely. The camera should return
to the wall rather than framing an empty cell. This is the `zones` action, and
it is the only path here that depends on the daemon rather than on input.

---

## Verification

`npm run typecheck` and `npx vitest run` pass. From the wall: click zooms,
arrows walk, click opens, Escape unwinds one level at a time, and a zone
expiring under the camera returns it to the wall.

## Risks

**Zoom is the one thing that promotes an LOD tier.** Plan 2's ratchet refuses to
grow a texture, deliberately. A zoomed pile therefore shows the deep cards at
the edge their rank earned, which at stack level may read as blurry. The spec
accepts a re-decode on zoom-in as an explicit user act; implementing it means
giving the manager a way to bypass the ratchet for one zone, and that is a
follow-up rather than part of this plan.

**Clicking a card at wall level is a small target.** The raycast hits whichever
card is nearest the camera, which at wall level is the top of a pile — fine for
"zoom to this pile," and the reason click means zoom rather than open there.
If the piles are dense enough that clicking misses, the fix is a per-zone
invisible pick plane, not a bigger card.
