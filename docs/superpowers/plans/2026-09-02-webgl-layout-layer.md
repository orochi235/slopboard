# WebGL Layout Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and unit-test the entire layout layer for the 3D wall — windease's two API additions, the linked dependency, the `dims` union, and the `stack` arrangement — with no renderer.

**Architecture:** Arrangements become windease `LayoutStrategy` implementations returning `Map<id, Rect>` plus a `channels` bag. `stack` groups live items by zone, tiles zone origins with `gridStrategy` at a unit container, and lays each zone's items down a diagonal whose depth is rank. Every number is a parameter. All of it is pure functions over plain data, so all of it is testable without a GL context.

**Tech Stack:** TypeScript, Vite 6, vitest, windease (linked local checkout at `~/src/windease`)

**Spec:** `docs/superpowers/specs/2026-09-02-webgl-backend-design.md`

## Scope: this is plan 1 of 3

The spec covers three subsystems. Splitting them keeps each plan's deliverable independently reviewable, and this one is the only part with meaningful unit tests.

1. **Layout layer (this plan)** — windease additions, linkage, `dims` union, params, `createRanks`, zone tiling, `stack`. Deliverable: `stack` returns correct geometry under test. Nothing renders.
2. **Renderer** — r3f canvas, quad meshes, texture pipeline, LOD tiers, byte budget, `webglcontextlost`, the `?backend=webgl` flag. Deliverable: the wall on screen. Verified by looking at it.
3. **Interaction** — camera levels, pointer raycast, arrow navigation, Escape, the DOM lightbox. Deliverable: zoom and click-through.

## Global Constraints

- **Node/tooling:** Vite 6, TypeScript strict, `verbatimModuleSyntax: true` — every type import must be `import type`.
- **Import extensions:** slopboard source imports carry explicit `.ts` extensions (`allowImportingTsExtensions: true`). Match the existing files.
- **Path aliases:** `@/*` → `./src/*`, `@shared/*` → `./shared/*`. Use them; do not write `../../`.
- **windease resolution:** aliased to `~/src/windease/src/index.ts` in both `vite.config.ts` and `vitest.config.ts`. Verified working — Vite remaps its `.js` import specifiers to the `.ts` files on disk. Any tool that bypasses the alias reads `dist` and silently sees stale code.
- **Purity:** every `layout()` is recomputed each frame. Motion must be closed-form in `now`. A per-`id` cache is allowed but dropping it may cost at most one frame of snapping.
- **Zone naming:** zone ids come from `Item.zone`, which is a directory name. Never derive or sanitize one.
- **Units:** world units, where z = 0 has visible height 1.0. `Rect` w/h is the **square slot** the image fits inside, never the image's own aspect.

## Deviation from the spec, decide before Task 6

The spec lists **State** as one of two conversions: `createSequencer`/`createSlots` become the strategy's `state` + `reduce`. That does not survive contact with windease's API. `reduce(state, event, context)` is driven by `LayoutEvent`s a host dispatches; there is no event for "a frame happened," so routing a per-frame allocator through it would require synthesizing an event per frame — the same objection the spec already raises against `ContainerHost`.

**This plan keeps the allocators as closures inside the strategy factory**, exactly as `createTide()` and `createErode()` do today, and passes `state: undefined`. The spec's equivalence is a true observation about shape, not a workable instruction. That leaves **one** real conversion: coordinates.

If the owner wants the allocators genuinely inside windease's state machinery, that is a windease change (a frame or tick event) and belongs in plan 1's scope only after being designed.

---

### Task 1: windease — `z` on `Rect`

Operates in **`~/src/windease`**, not slopboard. Separate repo, separate commit.

**Files:**
- Modify: `~/src/windease/src/layout-types.ts:10`
- Modify: every strategy emitting a `Rect`, and the existing tests asserting one
- Test: `~/src/windease/src/layout/grid.z.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `Rect = { x: number; y: number; z: number; w: number; h: number }`. Every rect the library emits sets `z`; a 2D strategy sets `0`. No read site needs `?? 0`.

**As implemented** (windease `main`, `9b45301`): the test landed as
`src/layout-types.rect-z.test.ts` rather than `grid.z.test.ts`, covering grid,
strip and stack plus affordance rects rather than grid alone. The sweep also
reached two emitters no grep had found, `react/focus/useFlowGeometry.ts` and
`usePublishGeometry.ts` — required `z` is what surfaced them.

`z` is required, so this task is a sweep, not a one-line addition: every strategy that builds a rect gains `z: 0`, and every existing test asserting a rect literal gains it too. That breadth is the cost of the guarantee — a read site never has to ask whether depth is present. It is a breaking change; windease is consumed from a linked checkout here, so nothing pins a version against it.

- [x] **Step 1: Write the failing test**

```ts
// ~/src/windease/src/layout/grid.z.test.ts
import { describe, expect, it } from 'vitest';
import { gridStrategy } from './grid.js';
import type { Rect } from '../layout-types.js';

describe('Rect.z', () => {
  it('carries depth', () => {
    const withZ: Rect = { x: 0, y: 0, z: -3, w: 1, h: 1 };
    expect(withZ.z).toBe(-3);
  });

  it('is 0 on every 2D strategy placement, never absent', () => {
    const out = gridStrategy.layout({
      items: [{ id: 'a' }, { id: 'b' }],
      container: { w: 1, h: 1 },
      state: undefined,
      options: { gap: 0, padding: 0 },
    });
    expect(out.placements.size).toBe(2);
    for (const rect of out.placements.values()) expect(rect.z).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/windease && npx vitest run src/layout/grid.z.test.ts`
Expected: FAIL — `Object literal may only specify known properties, and 'z' does not exist in type 'Rect'`.

- [x] **Step 3: Add the field**

In `~/src/windease/src/layout-types.ts`, replace line 10:

```ts
export type Rect = { x: number; y: number; w: number; h: number };
```

with:

```ts
/**
 * A positioned box. `z` is depth: a 2D layout sits at `0`, and every rect the
 * library emits sets it, so a host never tests for absence. It is geometry
 * rather than a channel because occlusion-aware drop targets will read it — a
 * forward commitment, not a current predicate.
 */
export type Rect = { x: number; y: number; z: number; w: number; h: number };
```

- [x] **Step 4: Sweep the emitters and the assertions**

Run `npx tsc --noEmit` and fix every error by adding `z: 0` to the rect the compiler names. Then run the suite: the remaining failures are `toEqual` assertions written before `z` existed, and each one gains `z: 0` in the expected literal. Both sets are mechanical, but the second is invisible to the compiler — a green `tsc` does not mean this step is done.

Do not weaken an assertion to `toMatchObject` to avoid the edit. The point of required `z` is that the exact shape is knowable.

- [x] **Step 5: Run the full suite**

Run: `cd ~/src/windease && npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [x] **Step 6: Commit**

```bash
cd ~/src/windease
git add -A
git commit -m "make z required on Rect"
```

---

### Task 2: windease — `channels` on `LayoutResult`

Operates in **`~/src/windease`**.

**Files:**
- Modify: `~/src/windease/src/layout-types.ts` (the `LayoutResult` interface, around line 220)
- Test: `~/src/windease/src/layout/channels.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `LayoutResult.channels?: Map<TId, Record<string, number>>`. Task 8 populates it; the renderer in plan 2 reads it.

**As implemented** (windease `main`, `9b45301` and `fdf3fd5`): the field alone
is inert. `ContainerHost` builds its own result object and dropped it, and the
presets published no channels to chrome at all, so three things this task does
not list were needed to make it reachable — the host wiring, `LayoutInfo.channels`
published by `<Zone>`/`<Panel>`, and `useChannelsForSelf(id)`. Removing
`windease/react`'s shadowing four-field `Rect` came with it. Tests are
`src/container-host.channels.test.ts`, a `Channels` Ladle story and
`e2e/channels.spec.ts`; windease requires a story and a CHANGELOG entry per
feature and this task mentions neither.

`Record<string, number>` and not a named type: the vocabulary belongs to the consumer, and every key name would otherwise be permanent under semver. `number` rather than `unknown` is the one assumption — cross-fade lerps every channel blindly by key.

- [x] **Step 1: Write the failing test**

```ts
// ~/src/windease/src/layout/channels.test.ts
import { describe, expect, it } from 'vitest';
import type { LayoutResult } from '../layout-types.js';

describe('LayoutResult.channels', () => {
  it('carries arbitrary numeric keys the core never reads', () => {
    const result: LayoutResult = {
      placements: new Map([['a', { x: 0, y: 0, z: 0, w: 1, h: 1 }]]),
      affordances: [],
      channels: new Map([['a', { opacity: 0.5, rotY: -0.3, lod: 2 }]]),
    };
    expect(result.channels?.get('a')?.opacity).toBe(0.5);
  });

  it('is optional', () => {
    const result: LayoutResult = { placements: new Map(), affordances: [] };
    expect(result.channels).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/windease && npx vitest run src/layout/channels.test.ts`
Expected: FAIL — `'channels' does not exist in type 'LayoutResult'`.

- [x] **Step 3: Add the field**

In `~/src/windease/src/layout-types.ts`, inside `export interface LayoutResult<...>`, after the `unplaced?: TId[]` member:

```ts
  /**
   * Per-item output this core has no predicate over — opacity, rotation, a
   * renderer's level-of-detail tier. Carried verbatim and never read: every
   * question layout asks is a predicate over geometry, and a number no such
   * question exists for does not belong in `Rect`. Untyped on purpose, so the
   * vocabulary stays with the consumer that owns it. Not a place for things
   * this core should reason about and cannot — extend the core for those.
   */
  channels?: Map<TId, Record<string, number>>;
```

- [x] **Step 4: Run the test and the full suite**

Run: `cd ~/src/windease && npx vitest run src/layout/channels.test.ts && npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [x] **Step 5: Commit**

```bash
cd ~/src/windease
git add src/layout-types.ts src/layout/channels.test.ts
git commit -m "carry consumer-defined channels through LayoutResult"
```

---

### Task 3: slopboard — vitest, the windease link, and proof of resolution

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`
- Create: `vitest.config.ts`, `src/arrangements/windease.link.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2 (`Rect.z`, `LayoutResult.channels`).
- Produces: `npm test` runs vitest with the windease alias active. Every later task depends on this.

The test in this task is not ceremony. Resolving windease through `dist` instead of the alias is a **silent** failure — stale code, no error — and this test is what makes it loud, because `Rect.z` and `channels` exist only in `src` until windease is rebuilt.

- [x] **Step 1: Write the failing test**

```ts
// src/arrangements/windease.link.test.ts
import { describe, expect, it } from 'vitest'
import { gridStrategy } from 'windease'
import type { LayoutResult, Rect } from 'windease'

describe('the windease link', () => {
  it('resolves the source checkout, not a stale dist', () => {
    // Both fields exist only in ~/src/windease/src until that repo is rebuilt.
    // A failure here means the alias is not in effect.
    const rect: Rect = { x: 0, y: 0, w: 1, h: 1, z: -2 }
    const result: LayoutResult = {
      placements: new Map([['a', rect]]),
      affordances: [],
      channels: new Map([['a', { opacity: 1 }]]),
    }
    expect(result.channels?.get('a')?.opacity).toBe(1)
  })

  it('tiles a unit container into fractional rects', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `z${i}` }))
    const out = gridStrategy.layout({
      items,
      container: { w: 1, h: 1 },
      state: undefined,
      options: { gap: 0.02, padding: 0.02 },
    })
    expect(out.placements.size).toBe(10)
    const first = out.placements.get('z0')!
    expect(first.x).toBeCloseTo(0.02)
    expect(first.y).toBeCloseTo(0.02)
    // 4 columns at this count, so a cell is well under half the container.
    expect(first.w).toBeLessThan(0.5)
    for (const r of out.placements.values()) {
      expect(r.x + r.w).toBeLessThanOrEqual(1.0001)
      expect(r.y + r.h).toBeLessThanOrEqual(1.0001)
    }
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npm test`
Expected: FAIL — no `test` script exists yet.

- [x] **Step 3: Add vitest and the dependency**

```bash
cd ~/src/slopboard
npm install -D vitest
npm install windease@file:../windease
```

Then add the script to `package.json`, beside the existing `typecheck`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [x] **Step 4: Add the alias in all three places**

In `vite.config.ts`, extend the existing `resolve.alias` object:

```ts
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      // Source, not dist: windease is co-designed with this repo, and its
      // `main` points at dist, where an edit to its src is invisible until a
      // rebuild — a stale answer with no error.
      windease: fileURLToPath(new URL('../windease/src/index.ts', import.meta.url)),
    },
```

Create `vitest.config.ts` — the same alias, because a vitest run without it reads `dist`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      windease: fileURLToPath(new URL('../windease/src/index.ts', import.meta.url)),
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
```

In `tsconfig.json`, add the path so `tsc --noEmit` agrees with the bundler, and include the new config file:

```json
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./shared/*"],
      "windease": ["../windease/src/index.ts"]
    },
```

and change `include` to:

```json
  "include": ["src", "server", "shared", "vite.config.ts", "vitest.config.ts"]
```

- [x] **Step 5: Run tests and typecheck**

Run: `cd ~/src/slopboard && npm test && npm run typecheck`
Expected: both PASS. If `Rect.z` errors, Tasks 1–2 are not committed in windease or the alias is not being applied.

- [x] **Step 6: Commit**

```bash
cd ~/src/slopboard
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig.json src/arrangements/windease.link.test.ts
git commit -m "link windease from source and add vitest"
```

---

### Task 4: slopboard — the `dims` tagged union

**Files:**
- Modify: `src/arrangements/types.ts`, `src/arrangements/grid.ts:11`, `src/arrangements/tide.ts:19`, `src/arrangements/erode.ts:32`, `src/arrangements/index.ts`, `src/App.tsx`
- Test: `src/arrangements/registry.test.ts` (create)

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `type Arrangement2D = { name: string; dims: 2; arrange(items: Item[], viewport: Size, t: number): Placement[] }`
  - `type Arrangement3D = { name: string; dims: 3; camera?: Camera; strategy: SlopStrategy }`
  - `type Arrangement = Arrangement2D | Arrangement3D`
  - `type Camera = { fovDeg: number; z: number }`
  - `arrangementsFor(dims: 2 | 3): Arrangement[]`

`needs3d: boolean` cannot discriminate two different shapes, which is the whole reason for the change. `App.tsx` currently indexes `arrangements` directly; it must go through `arrangementsFor(2)` so the DOM backend never lands on a 3D arrangement.

- [x] **Step 1: Write the failing test**

```ts
// src/arrangements/registry.test.ts
import { describe, expect, it } from 'vitest'
import { arrangements, arrangementsFor } from '@/arrangements/index.ts'

describe('the arrangement registry', () => {
  it('tags every arrangement with its dimensionality', () => {
    for (const a of arrangements) expect([2, 3]).toContain(a.dims)
  })

  it('filters to one backend, and grid stays the 2D control', () => {
    const flat = arrangementsFor(2)
    expect(flat.length).toBeGreaterThan(0)
    expect(flat.every((a) => a.dims === 2)).toBe(true)
    expect(flat[0]?.name).toBe('grid')
  })

  it('narrows on dims', () => {
    for (const a of arrangements) {
      if (a.dims === 2) expect(typeof a.arrange).toBe('function')
      else expect(typeof a.strategy.layout).toBe('function')
    }
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npm test -- src/arrangements/registry.test.ts`
Expected: FAIL — `arrangementsFor` is not exported.

- [x] **Step 3: Rewrite the type module**

In `src/arrangements/types.ts`, replace the `Arrangement` type with:

```ts
import type { LayoutResult, LayoutItem, Size as WeSize } from 'windease'

/** Where the 3D scene's camera sits. Fixed today; a value so it need not be. */
export type Camera = { fovDeg: number; z: number }

/** slopboard's own channel vocabulary. windease carries these and never reads them. */
export type SlopChannels = {
  z: number
  opacity: number
  rotX: number
  rotY: number
  rotZ: number
  saturation?: number
  blur?: number
  lod?: number
}

export type SlopStrategy = {
  name: string
  layout(input: {
    items: LayoutItem[]
    container: WeSize
    state: undefined
    options: Record<string, unknown>
  }): LayoutResult
}

export type Arrangement2D = {
  name: string
  dims: 2
  arrange(items: Item[], viewport: Size, t: number): Placement[]
}

export type Arrangement3D = {
  name: string
  dims: 3
  camera?: Camera
  strategy: SlopStrategy
}

export type Arrangement = Arrangement2D | Arrangement3D
```

- [x] **Step 4: Migrate the three existing arrangements**

In each of `grid.ts`, `tide.ts`, `erode.ts`, change the one field:

```ts
  needs3d: false,
```

to:

```ts
  dims: 2,
```

and change each file's `Arrangement` type import to `Arrangement2D`, adjusting the annotation (`export const grid: Arrangement2D`, `): Arrangement2D {`).

- [x] **Step 5: Add the filter to the registry**

In `src/arrangements/index.ts`:

```ts
import { grid } from './grid.ts'
import { createTide } from './tide.ts'
import { createErode } from './erode.ts'
import type { Arrangement } from './types.ts'

/** Order is the cycle order under `[` / `]`. grid is the 2D control. */
export const arrangements: Arrangement[] = [grid, createTide(), createErode()]

/** One backend never cycles into the other's arrangements. */
export const arrangementsFor = (dims: 2 | 3): Arrangement[] =>
  arrangements.filter((a) => a.dims === dims)

export type {
  Arrangement,
  Arrangement2D,
  Arrangement3D,
  Camera,
  Item,
  Placement,
  Size,
  SlopChannels,
  SlopStrategy,
} from './types.ts'
```

- [x] **Step 6: Point App.tsx at the filtered list**

In `src/App.tsx`, replace the two `arrangements` references. Add near the top of the component:

```tsx
  const available = arrangementsFor(2)
```

then use `available.length` in the key handler and `available[index]` for the arrangement, and narrow before rendering:

```tsx
  const arrangement = available[index]
  if (!arrangement || arrangement.dims !== 2) return null
```

Change the import to `import { arrangementsFor } from '@/arrangements/index.ts'`.

- [x] **Step 7: Run tests and typecheck**

Run: `cd ~/src/slopboard && npm test && npm run typecheck`
Expected: both PASS.

- [x] **Step 8: Commit**

```bash
cd ~/src/slopboard
git add src/arrangements src/App.tsx
git commit -m "tag arrangements with dims and filter the registry per backend"
```

---

### Task 5: slopboard — the parameter surface

**Files:**
- Create: `src/params.ts`
- Test: `src/params.test.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces: `defaultParams: StackParams` and `type StackParams`. Tasks 6–8 read from it; plan 2's renderer reads the LOD and camera fields.

Every number in the spec lives here and nowhere else. Tuning by editing source does not converge, so the renderer will bind these to controls in plan 2 — which only works if no constant escapes into a strategy body.

- [x] **Step 1: Write the failing test**

```ts
// src/params.test.ts
import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/params.ts'

describe('defaultParams', () => {
  it('describes the pile, the grid, the camera and the LOD tiers', () => {
    const p = defaultParams
    expect(p.step.z).toBeLessThan(0) // the pile recedes from the camera
    expect(p.shoveMs).toBeGreaterThan(0)
    expect(p.zoneGrid.gap).toBeGreaterThan(0)
    expect(p.camera.fovDeg).toBeGreaterThan(0)
    expect(p.lod.map((t) => t.maxRank)).toEqual([...p.lod.map((t) => t.maxRank)].sort((a, b) => a - b))
    expect(p.lod.at(-1)?.edge).toBe(0) // the tail is a flat colored quad
  })

  it('is a plain object, so a control panel can clone and patch it', () => {
    expect(JSON.parse(JSON.stringify(defaultParams))).toEqual(defaultParams)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npm test -- src/params.test.ts`
Expected: FAIL — cannot resolve `@/params.ts`.

- [x] **Step 3: Write the module**

```ts
// src/params.ts

/** One LOD tier. `edge` of 0 means no texture — a flat quad in the average color. */
export type LodTier = { maxRank: number; edge: 0 | 32 | 128 | 512 }

export type StackParams = {
  /** Per-rank offset within a pile, in world units. z is negative: away. */
  step: { x: number; y: number; z: number }
  /** Constant world side of each item's square slot. */
  side: number
  /** Constant card angles, radians. */
  rot: { x: number; y: number }
  /** Deterministic per-id jitter, radians and world units. */
  jitter: { rot: number; pos: number }
  /** How long a rank change takes to animate. */
  shoveMs: number
  /** Ranks past this are not placed at all. */
  rankCap: number
  /** age01 window over which an item fades out. */
  fade: { from: number; to: number }
  zoneGrid: { gap: number; padding: number; orientation: 'wide' | 'tall'; cols?: number; rows?: number }
  camera: { fovDeg: number }
  lod: LodTier[]
  /** Texture byte budget. A backstop, not the thing shaping the design. */
  textureBudgetBytes: number
}

export const defaultParams: StackParams = {
  step: { x: 0.012, y: -0.012, z: -0.035 },
  side: 0.22,
  rot: { x: -0.12, y: 0.34 },
  jitter: { rot: 0.03, pos: 0.004 },
  shoveMs: 420,
  rankCap: 200,
  fade: { from: 0.88, to: 1 },
  zoneGrid: { gap: 0.02, padding: 0.02, orientation: 'wide' },
  camera: { fovDeg: 35 },
  lod: [
    { maxRank: 1, edge: 512 },
    { maxRank: 8, edge: 128 },
    { maxRank: 40, edge: 32 },
    { maxRank: Number.MAX_SAFE_INTEGER, edge: 0 },
  ],
  textureBudgetBytes: 256 * 1024 * 1024,
}
```

- [x] **Step 4: Run tests**

Run: `cd ~/src/slopboard && npm test -- src/params.test.ts && npm run typecheck`
Expected: both PASS.

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/params.ts src/params.test.ts
git commit -m "collect every stack constant into one parameter object"
```

---

### Task 6: slopboard — `createRanks`

**Files:**
- Modify: `src/arrangements/slots.ts`
- Test: `src/arrangements/slots.ranks.test.ts` (create)

**Interfaces:**
- Consumes: Task 3.
- Produces:
  ```ts
  type RankEntry = { rank: number; prevRank: number; changedAt: number }
  createRanks(): (ids: string[], now: number) => Map<string, RankEntry>
  ```
  Task 8 turns an entry into depth with `lerp(prevRank, rank, ease((now - changedAt) / shoveMs))`.

`ids` arrives already ordered newest-first; the allocator does not sort. Rank is the index in that list, so it changes both when something arrives ahead of an item and when something expires ahead of it — the second case moves an item *forward*, which is the mid-pile expiry the spec calls out. Dropping the whole cache must snap everything to target rather than animate from a lie, so a first sighting sets `prevRank === rank`.

- [x] **Step 1: Write the failing test**

```ts
// src/arrangements/slots.ranks.test.ts
import { describe, expect, it } from 'vitest'
import { createRanks } from '@/arrangements/slots.ts'

describe('createRanks', () => {
  it('ranks by position in the given order, newest first', () => {
    const ranks = createRanks()
    const held = ranks(['a', 'b', 'c'], 1000)
    expect(held.get('a')?.rank).toBe(0)
    expect(held.get('c')?.rank).toBe(2)
  })

  it('starts an item settled, so a dropped cache snaps instead of animating', () => {
    const ranks = createRanks()
    const held = ranks(['a'], 1000)
    expect(held.get('a')).toEqual({ rank: 0, prevRank: 0, changedAt: 1000 })
  })

  it('records the previous rank and the moment it changed on an arrival', () => {
    const ranks = createRanks()
    ranks(['a'], 1000)
    const held = ranks(['new', 'a'], 1500)
    expect(held.get('a')).toEqual({ rank: 1, prevRank: 0, changedAt: 1500 })
    expect(held.get('new')).toEqual({ rank: 0, prevRank: 0, changedAt: 1500 })
  })

  it('moves items forward when one expires out of the middle', () => {
    const ranks = createRanks()
    ranks(['a', 'b', 'c'], 1000)
    const held = ranks(['a', 'c'], 2000)
    expect(held.get('c')).toEqual({ rank: 1, prevRank: 2, changedAt: 2000 })
    // 'a' never moved, so its transition is untouched and already complete.
    expect(held.get('a')).toEqual({ rank: 0, prevRank: 0, changedAt: 1000 })
  })

  it('does not restart a transition while the rank holds steady', () => {
    const ranks = createRanks()
    ranks(['a'], 1000)
    ranks(['new', 'a'], 1500)
    const held = ranks(['new', 'a'], 1900)
    expect(held.get('a')?.changedAt).toBe(1500)
  })

  it('forgets items that are gone', () => {
    const ranks = createRanks()
    ranks(['a', 'b'], 1000)
    const held = ranks(['a'], 2000)
    expect(held.has('b')).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npm test -- src/arrangements/slots.ranks.test.ts`
Expected: FAIL — `createRanks` is not exported from `slots.ts`.

- [x] **Step 3: Implement it**

Append to `src/arrangements/slots.ts`:

```ts
export type RankEntry = { rank: number; prevRank: number; changedAt: number }

/**
 * Rank plus the moment it last changed, which is what lets a rank change
 * animate from a pure function: depth interpolates prevRank → rank over a
 * fixed duration measured from `changedAt`. A first sighting is already
 * settled, so dropping the cache snaps to target rather than sliding in from
 * a rank the item never held.
 */
export function createRanks() {
  const held = new Map<string, RankEntry>()
  return (ids: string[], now: number): Map<string, RankEntry> => {
    const present = new Set(ids)
    for (const id of [...held.keys()]) if (!present.has(id)) held.delete(id)
    ids.forEach((id, rank) => {
      const prev = held.get(id)
      if (!prev) held.set(id, { rank, prevRank: rank, changedAt: now })
      else if (prev.rank !== rank) held.set(id, { rank, prevRank: prev.rank, changedAt: now })
    })
    return held
  }
}
```

- [x] **Step 4: Run tests**

Run: `cd ~/src/slopboard && npm test -- src/arrangements/slots.ranks.test.ts && npm run typecheck`
Expected: both PASS.

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/arrangements/slots.ts src/arrangements/slots.ranks.test.ts
git commit -m "track rank transitions so the shove animates from a pure function"
```

---

### Task 7: slopboard — zone tiling

**Files:**
- Create: `src/arrangements/zones.ts`
- Test: `src/arrangements/zones.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 5, 6 (`createSlots` from `slots.ts`).
- Produces:
  ```ts
  createZoneGrid(): (zones: string[], container: WeSize, params: StackParams['zoneGrid']) => Map<string, Rect>
  ```
  Task 8 uses each rect as a pile's origin and footprint.

Cell assignment goes through the existing `createSlots()` lowest-free allocator keyed by zone name, so a zone keeps its cell for as long as it exists. Sorting alphabetically would reshuffle every pile on the wall the first time an agent writes to a new repo.

- [x] **Step 1: Write the failing test**

```ts
// src/arrangements/zones.test.ts
import { describe, expect, it } from 'vitest'
import { createZoneGrid } from '@/arrangements/zones.ts'
import { defaultParams } from '@/params.ts'

const container = { w: 16 / 9, h: 1 }
const cfg = defaultParams.zoneGrid

describe('createZoneGrid', () => {
  it('places one rect per zone inside the container', () => {
    const gridOf = createZoneGrid()
    const out = gridOf(['weasel', 'klieg', 'wod'], container, cfg)
    expect(out.size).toBe(3)
    for (const r of out.values()) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(container.w + 0.0001)
      expect(r.y + r.h).toBeLessThanOrEqual(container.h + 0.0001)
    }
  })

  it('keeps a zone in its cell when another zone appears', () => {
    const gridOf = createZoneGrid()
    const before = gridOf(['weasel', 'klieg'], container, cfg)
    const weaselBefore = before.get('weasel')!
    const after = gridOf(['weasel', 'klieg', 'brand-new'], container, cfg)
    // The cell index is stable; the cell's size changes as the grid rebalances.
    expect(after.get('weasel')!.x).toBeLessThanOrEqual(weaselBefore.x + 0.0001)
    expect(after.has('brand-new')).toBe(true)
  })

  it('reuses a freed cell rather than growing the grid forever', () => {
    const gridOf = createZoneGrid()
    gridOf(['a', 'b', 'c'], container, cfg)
    const after = gridOf(['a', 'c'], container, cfg)
    expect(after.size).toBe(2)
  })

  it('is insensitive to the order zones are handed in', () => {
    const gridOf = createZoneGrid()
    const first = gridOf(['a', 'b'], container, cfg)
    const second = gridOf(['b', 'a'], container, cfg)
    expect(second.get('a')).toEqual(first.get('a'))
    expect(second.get('b')).toEqual(first.get('b'))
  })

  it('returns nothing for an empty wall', () => {
    expect(createZoneGrid()([], container, cfg).size).toBe(0)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npm test -- src/arrangements/zones.test.ts`
Expected: FAIL — cannot resolve `@/arrangements/zones.ts`.

- [x] **Step 3: Implement it**

```ts
// src/arrangements/zones.ts
import { gridStrategy } from 'windease'
import type { Rect, Size as WeSize } from 'windease'
import { createSlots } from './slots.ts'
import type { StackParams } from '@/params.ts'

/**
 * One cell per zone, tiled by windease. Cells are addressed by slot index
 * rather than by sorted zone name: a zone that arrives when an agent first
 * writes to a new repo must not move every pile already on the wall.
 */
export function createZoneGrid() {
  const slots = createSlots()

  return (
    zones: string[],
    container: WeSize,
    cfg: StackParams['zoneGrid'],
  ): Map<string, Rect> => {
    if (zones.length === 0) return new Map()

    const held = slots([...zones].sort())
    const byIndex = [...held.entries()].sort((a, b) => a[1] - b[1])

    const out = gridStrategy.layout({
      items: byIndex.map(([zone]) => ({ id: zone })),
      container,
      state: undefined,
      options: {
        gap: cfg.gap,
        padding: cfg.padding,
        orientation: cfg.orientation,
        ...(cfg.cols === undefined ? {} : { cols: cfg.cols }),
        ...(cfg.rows === undefined ? {} : { rows: cfg.rows }),
      },
    })

    return out.placements
  }
}
```

- [x] **Step 4: Run tests**

Run: `cd ~/src/slopboard && npm test -- src/arrangements/zones.test.ts && npm run typecheck`
Expected: both PASS. If the stability test fails, `createSlots` is being handed zones in a varying order — it allocates in the order given, so the sort before it is load-bearing.

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/arrangements/zones.ts src/arrangements/zones.test.ts
git commit -m "tile one grid cell per zone, stable across an added zone"
```

---

### Task 8: slopboard — the `stack` arrangement

**Files:**
- Create: `src/arrangements/stack.ts`
- Modify: `src/arrangements/index.ts`
- Test: `src/arrangements/stack.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 5, 6, 7.
- Produces: `createStack(params?: StackParams): Arrangement3D`, registered in `arrangements`. Plan 2's renderer consumes its `placements` and `channels`.

`items` reach the strategy as windease `LayoutItem`s, so slopboard's per-item data (`zone`, `age01`) rides along. Declare the input shape once:

```ts
type StackItem = LayoutItem & { zone: string; age01: number }
```

Geometry is the square slot (`w = h = params.side`), never the image's aspect — the renderer fits the image inside, as `DomBackend.write()` already does.

- [x] **Step 1: Write the failing test**

```ts
// src/arrangements/stack.test.ts
import { describe, expect, it } from 'vitest'
import { createStack } from '@/arrangements/stack.ts'
import { defaultParams } from '@/params.ts'

const container = { w: 16 / 9, h: 1 }
const item = (id: string, zone: string, age01 = 0) => ({ id, zone, age01 })

const run = (
  stack: ReturnType<typeof createStack>,
  items: ReturnType<typeof item>[],
  now: number,
) => stack.strategy.layout({ items, container, state: undefined, options: { now } })

describe('stack', () => {
  it('is a 3D arrangement', () => {
    expect(createStack().dims).toBe(3)
  })

  it('emits a square slot, never the image aspect', () => {
    const out = run(createStack(), [item('a', 'weasel')], 0)
    const rect = out.placements.get('a')!
    expect(rect.w).toBe(defaultParams.side)
    expect(rect.h).toBe(rect.w)
  })

  it('recedes one step per rank within a zone', () => {
    const stack = createStack()
    // Settled: both items present from the first call, so no shove is running.
    const out = run(stack, [item('new', 'z'), item('old', 'z')], 0)
    const near = out.placements.get('new')!
    const far = out.placements.get('old')!
    expect(far.z).toBeLessThan(near.z)
    expect(far.z - near.z).toBeCloseTo(defaultParams.step.z)
  })

  it('puts each zone in its own cell', () => {
    const out = run(createStack(), [item('a', 'weasel'), item('b', 'klieg')], 0)
    const a = out.placements.get('a')!
    const b = out.placements.get('b')!
    expect(a.x).not.toBeCloseTo(b.x)
  })

  it('animates a shove rather than jumping', () => {
    const stack = createStack()
    const shove = defaultParams.shoveMs
    run(stack, [item('a', 'z')], 0)
    // The arrival is its own call: a rank change is recorded at `now`, so
    // sampling in the same call always reads settle = 0 and proves nothing.
    run(stack, [item('new', 'z'), item('a', 'z')], 1000)
    const mid = run(stack, [item('new', 'z'), item('a', 'z')], 1000 + shove / 2)
    const zMid = mid.placements.get('a')!.z
    const settled = run(stack, [item('new', 'z'), item('a', 'z')], 1000 + shove * 4)
    const zEnd = settled.placements.get('a')!.z
    expect(zEnd).toBeCloseTo(defaultParams.step.z)
    // Halfway through, 'a' is between rank 0 and rank 1.
    expect(zMid).toBeLessThan(0)
    expect(zMid).toBeGreaterThan(zEnd)
  })

  it('fades only with age, wherever the item sits', () => {
    const stack = createStack()
    const out = run(stack, [item('young', 'z', 0), item('dying', 'z', 1)], 0)
    expect(out.channels!.get('young')!.opacity).toBeCloseTo(1)
    expect(out.channels!.get('dying')!.opacity).toBeCloseTo(0)
  })

  it('jitters deterministically, so a dropped cache does not reshuffle the pile', () => {
    const a = run(createStack(), [item('x', 'z')], 0)
    const b = run(createStack(), [item('x', 'z')], 0)
    expect(a.channels!.get('x')!.rotZ).toBe(b.channels!.get('x')!.rotZ)
  })

  it('assigns an LOD tier by rank and reports the deep tail as unplaced past the cap', () => {
    const params = { ...defaultParams, rankCap: 3 }
    const items = Array.from({ length: 6 }, (_, i) => item(`i${i}`, 'z'))
    const out = run(createStack(params), items, 0)
    expect(out.placements.size).toBe(3)
    expect(out.unplaced).toEqual(['i3', 'i4', 'i5'])
    expect(out.channels!.get('i0')!.lod).toBe(512)
    expect(out.channels!.get('i2')!.lod).toBe(128)
  })

  it('places nothing for an empty wall', () => {
    const out = run(createStack(), [], 0)
    expect(out.placements.size).toBe(0)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npm test -- src/arrangements/stack.test.ts`
Expected: FAIL — cannot resolve `@/arrangements/stack.ts`.

- [x] **Step 3: Implement it**

```ts
// src/arrangements/stack.ts
import type { LayoutItem, LayoutResult, Rect, Size as WeSize } from 'windease'
import { createRanks, ramp } from './slots.ts'
import { createZoneGrid } from './zones.ts'
import { defaultParams, type StackParams } from '@/params.ts'
import type { Arrangement3D, SlopChannels } from './types.ts'

type StackItem = LayoutItem & { zone: string; age01: number }

/** Stable per-id noise in [-1, 1]. Cheap, and identical across cache drops. */
function hashUnit(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

const lodFor = (rank: number, tiers: StackParams['lod']) =>
  tiers.find((tier) => rank <= tier.maxRank)?.edge ?? 0

/**
 * One diagonal pile per zone, tiled to a grid. Depth is rank, so an arrival
 * shoves its pile back one step and spacing stays even at any arrival rate;
 * age drives opacity alone, which is why a quiet wall shows its top card dying
 * in place rather than at the far end.
 */
export function createStack(params: StackParams = defaultParams): Arrangement3D {
  const ranksByZone = new Map<string, ReturnType<typeof createRanks>>()
  const zoneGrid = createZoneGrid()

  const ranksFor = (zone: string) => {
    let ranks = ranksByZone.get(zone)
    if (!ranks) {
      ranks = createRanks()
      ranksByZone.set(zone, ranks)
    }
    return ranks
  }

  return {
    name: 'stack',
    dims: 3,
    camera: { fovDeg: params.camera.fovDeg, z: 0.5 / Math.tan((params.camera.fovDeg * Math.PI) / 360) },
    strategy: {
      name: 'slop-stack',
      layout({ items, container, options }): LayoutResult {
        const now = typeof options.now === 'number' ? options.now : Date.now()
        const all = items as StackItem[]

        const byZone = new Map<string, StackItem[]>()
        for (const it of all) {
          const bucket = byZone.get(it.zone)
          if (bucket) bucket.push(it)
          else byZone.set(it.zone, [it])
        }
        for (const bucket of byZone.values()) bucket.sort((a, b) => a.age01 - b.age01)

        const cells = zoneGrid([...byZone.keys()], container, params.zoneGrid)

        const placements = new Map<string, Rect>()
        const channels = new Map<string, Record<string, number>>()
        const unplaced: string[] = []

        for (const [zone, bucket] of byZone) {
          const cell = cells.get(zone)
          if (!cell) continue
          const held = ranksFor(zone)(bucket.map((i) => i.id), now)

          for (const it of bucket) {
            const entry = held.get(it.id)
            if (!entry) continue
            if (entry.rank >= params.rankCap) {
              unplaced.push(it.id)
              continue
            }

            const settle = easeOut(Math.min(1, (now - entry.changedAt) / params.shoveMs))
            const depth = entry.prevRank + (entry.rank - entry.prevRank) * settle
            const noise = hashUnit(it.id)

            placements.set(it.id, {
              x: cell.x + depth * params.step.x + noise * params.jitter.pos,
              y: cell.y + depth * params.step.y + noise * params.jitter.pos,
              z: depth * params.step.z,
              w: params.side,
              h: params.side,
            })

            const ch: SlopChannels = {
              z: depth * params.step.z,
              opacity: 1 - ramp(it.age01, params.fade.from, params.fade.to),
              rotX: params.rot.x,
              rotY: params.rot.y,
              rotZ: noise * params.jitter.rot,
              lod: lodFor(entry.rank, params.lod),
            }
            channels.set(it.id, ch as unknown as Record<string, number>)
          }
        }

        return { placements, affordances: [], channels, ...(unplaced.length ? { unplaced } : {}) }
      },
    },
  }
}
```

- [x] **Step 4: Register it**

In `src/arrangements/index.ts`, import and append it:

```ts
import { createStack } from './stack.ts'
```

```ts
export const arrangements: Arrangement[] = [grid, createTide(), createErode(), createStack()]
```

- [x] **Step 5: Run the whole suite**

Run: `cd ~/src/slopboard && npm test && npm run typecheck`
Expected: all PASS, including Task 4's registry test now seeing a `dims: 3` entry.

- [x] **Step 6: Commit**

```bash
cd ~/src/slopboard
git add src/arrangements/stack.ts src/arrangements/stack.test.ts src/arrangements/index.ts
git commit -m "one diagonal pile per zone, depth by rank"
```

---

## Done when

`npm test && npm run typecheck` passes in slopboard, `npm test && npm run typecheck && npm run lint` passes in windease, and `createStack().strategy.layout(...)` returns correct geometry for a multi-zone wall. Nothing renders — that is plan 2.
