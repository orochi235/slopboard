# WebGL Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the wall on screen in WebGL — one diagonal pile per zone, drawn from the `stack` arrangement plan 1 already returns under test.

**Architecture:** `createStack().strategy.layout()` is already a pure function of items and a container. This plan adds no layout thinking at all: it projects `WallItem[]` into the strategy's input, calls it once per frame, and draws the `placements` + `channels` it returns. Everything with a decidable answer — the item projection, LOD tier selection, texture eviction, average color, the backend flag — lives in a plain module with unit tests. `WebglBackend.tsx` is a thin r3f shell over those, because it is the only part no test can judge.

**Tech Stack:** three, @react-three/fiber, React 19, Vite 6, vitest.

---

## Scope: this is plan 2 of 3

1. ~~**Layout layer**~~ — done, on `main`.
2. **Renderer (this plan)** — r3f canvas, quad meshes, texture pipeline, LOD tiers, byte budget, `webglcontextlost`, the `?backend=webgl` flag. Deliverable: the wall on screen.
3. **Interaction** — camera levels, pointer raycast, arrow navigation, Escape, the DOM lightbox.

## What this plan cannot verify

The spec's deliverable for this stage is "verified by looking at it," and that is honest: whether a pile of 200 reads as depth in peripheral vision is the question the whole project exists to answer. No test here asserts that.

So every task below either has a unit test or is explicitly marked **eyes only**. Task 10 is the handoff: it produces a running wall and a screenshot, and the judgment is the owner's.

## Global Constraints

- **Import extensions:** slopboard source imports carry explicit `.ts`/`.tsx` extensions. Match the existing files.
- **Path aliases:** `@/*` → `./src/*`, `@shared/*` → `./shared/*`. Use them; never write `../../`.
- **windease resolution:** aliased to `~/src/windease/src/index.ts` in `vite.config.ts` and `vitest.config.ts`. Anything bypassing the alias reads `dist` and silently sees stale code.
- **Purity:** `layout()` is recomputed each frame. Motion is closed-form in `now`. A per-`id` cache may be dropped at a cost of at most one frame.
- **No new layout decisions.** If a number is needed, it belongs in `StackParams` (`src/params.ts`), not in a renderer file.
- **World units:** z = 0 is the plane with visible height 1.0. `Rect.w`/`h` is the **square slot**; the mesh applies image aspect inside it.

---

### Task 1: The backend flag

`?backend=webgl` picks the renderer for the window's life. A startup flag, not a
toggle, so a DOM wall and a 3D wall can run on two monitors at once.

**Files:**
- Create: `src/backend-flag.ts`
- Create: `src/backend-flag.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/backend-flag.test.ts
import { describe, expect, it } from 'vitest'
import { backendFrom } from '@/backend-flag.ts'

describe('backendFrom', () => {
  it('defaults to the DOM wall', () => {
    expect(backendFrom('')).toBe('dom')
    expect(backendFrom('?foo=1')).toBe('dom')
  })

  it('selects webgl only on an exact match', () => {
    expect(backendFrom('?backend=webgl')).toBe('webgl')
    expect(backendFrom('?a=1&backend=webgl&b=2')).toBe('webgl')
  })

  it('falls back rather than throwing on a value it does not know', () => {
    expect(backendFrom('?backend=vulkan')).toBe('dom')
    expect(backendFrom('?backend=')).toBe('dom')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/backend-flag.test.ts`
Expected: FAIL — "Failed to resolve import @/backend-flag.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/backend-flag.ts
export type BackendName = 'dom' | 'webgl'

/**
 * Read once at startup. One backend per window for its life, so the DOM wall
 * and the 3D wall can run on two monitors at once without a shared toggle.
 */
export function backendFrom(search: string): BackendName {
  return new URLSearchParams(search).get('backend') === 'webgl' ? 'webgl' : 'dom'
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/backend-flag.test.ts`
Expected: PASS, 3 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/backend-flag.ts src/backend-flag.test.ts
git commit -m "pick the backend from a startup flag"
```

---

### Task 2: Projecting wall items into strategy items

`DomBackend` builds its `Item[]` inline every frame. The 3D path needs the same
projection into the shape `createStack`'s strategy reads (`LayoutItem & { zone,
age01 }`), and it is worth extracting because it is the one piece of per-frame
arithmetic with a right answer.

**Files:**
- Create: `src/model.ts`
- Create: `src/model.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/model.test.ts
import { describe, expect, it } from 'vitest'
import { toStackItems } from '@/model.ts'
import type { WallItem } from '@shared/protocol.ts'

const item = (over: Partial<WallItem> = {}): WallItem => ({
  id: 'a',
  url: '/img/a',
  origUrl: '/orig/a',
  zone: 'windease',
  bornAt: 1000,
  w: 200,
  h: 100,
  ...over,
})

describe('toStackItems', () => {
  it('derives age01 from the daemon clock, not the browser clock', () => {
    // now = 3000 on the daemon: 2000ms into a 4000ms life.
    const [out] = toStackItems([item()], { now: 3000, ttlMs: 4000 })
    expect(out!.age01).toBe(0.5)
  })

  it('clamps a past-expiry item to 1 rather than reporting more than a life', () => {
    const [out] = toStackItems([item()], { now: 99_000, ttlMs: 4000 })
    expect(out!.age01).toBe(1)
  })

  it('clamps a clock-skewed future arrival to 0', () => {
    const [out] = toStackItems([item({ bornAt: 5000 })], { now: 3000, ttlMs: 4000 })
    expect(out!.age01).toBe(0)
  })

  it('carries zone and id through, and aspect from the stored dimensions', () => {
    const [out] = toStackItems([item()], { now: 1000, ttlMs: 4000 })
    expect(out!.id).toBe('a')
    expect(out!.zone).toBe('windease')
    expect(out!.aspect).toBe(2)
  })

  it('treats a zero-height item as square rather than dividing by zero', () => {
    const [out] = toStackItems([item({ h: 0 })], { now: 1000, ttlMs: 4000 })
    expect(out!.aspect).toBe(1)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/model.test.ts`
Expected: FAIL — "Failed to resolve import @/model.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/model.ts
import type { LayoutItem } from 'windease'
import type { WallItem } from '@shared/protocol.ts'

/** What `createStack`'s strategy reads: a windease item plus the two fields
 *  the arrangement needs. `aspect` is for the mesh, never for the layout. */
export type StackItem = LayoutItem & { zone: string; age01: number; aspect: number }

/** `now` is the daemon's clock, not the browser's — decay stays server-anchored
 *  so a reload changes nothing about the wall. */
export function toStackItems(
  items: readonly WallItem[],
  clock: { now: number; ttlMs: number },
): StackItem[] {
  return items.map((i) => ({
    id: i.id,
    zone: i.zone,
    age01: Math.max(0, Math.min(1, (clock.now - i.bornAt) / clock.ttlMs)),
    aspect: i.h > 0 ? i.w / i.h : 1,
  }))
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/model.test.ts`
Expected: PASS, 5 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/model.ts src/model.test.ts
git commit -m "project wall items onto the stack strategy's input"
```

---

### Task 3: The LOD ratchet

`lodFor` already picks a tier by rank inside `stack.ts`, and the channel carries
it. What the renderer needs on top is the **ratchet**: an item's texture may only
ever get smaller over its life, because rank only increases while its neighbours
live. That is what makes "dispose the large one, upload the small one" safe
without ever re-decoding at a larger size.

Zoom is the one thing that promotes a tier, and it is plan 3's problem. This
function takes the previous edge so the ratchet is explicit rather than implied.

**Files:**
- Create: `src/textures/ratchet.ts`
- Create: `src/textures/ratchet.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/textures/ratchet.test.ts
import { describe, expect, it } from 'vitest'
import { ratchet } from '@/textures/ratchet.ts'

describe('ratchet', () => {
  it('takes the requested edge when nothing is held yet', () => {
    expect(ratchet(undefined, 512)).toBe(512)
  })

  it('shrinks when the item sinks down the pile', () => {
    expect(ratchet(512, 128)).toBe(128)
    expect(ratchet(128, 0)).toBe(0)
  })

  it('refuses to grow, which is what makes the downgrade path re-decode-free', () => {
    expect(ratchet(128, 512)).toBe(128)
    expect(ratchet(0, 512)).toBe(0)
  })

  it('holds steady when the tier has not changed', () => {
    expect(ratchet(128, 128)).toBe(128)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/textures/ratchet.test.ts`
Expected: FAIL — "Failed to resolve import @/textures/ratchet.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/textures/ratchet.ts
import type { LodTier } from '@/params.ts'

export type Edge = LodTier['edge']

/**
 * An item's texture only ever shrinks. Rank rises while its neighbours live, so
 * a larger request is either a stale frame or a zoom — and zoom re-decodes
 * deliberately (plan 3) rather than through this path.
 */
export function ratchet(held: Edge | undefined, want: Edge): Edge {
  if (held === undefined) return want
  return want < held ? want : held
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/textures/ratchet.test.ts`
Expected: PASS, 4 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/textures/ratchet.ts src/textures/ratchet.test.ts
git commit -m "let an item's texture shrink but never grow"
```

---

### Task 4: The byte-budgeted store

A backstop, not the thing shaping the design — LOD already does that. It exists
because `webglcontextlost` from VRAM exhaustion is silent and unrecoverable
without it, which `DESIGN.md` names as a trap.

Generic over what it holds so it can be tested with no GL context: the store
calls a `dispose` callback and never touches three itself.

**Files:**
- Create: `src/textures/store.ts`
- Create: `src/textures/store.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/textures/store.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createTextureStore } from '@/textures/store.ts'

const bytes = (edge: number) => edge * edge * 4

describe('createTextureStore', () => {
  it('holds what fits and reports its size', () => {
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 2 })
    store.put('a', 'tex-a', bytes(512))
    store.put('b', 'tex-b', bytes(512))
    expect(store.get('a')).toBe('tex-a')
    expect(store.size()).toBe(2)
  })

  it('evicts least-recently-used first and disposes what it drops', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 2, dispose })
    store.put('a', 'tex-a', bytes(512))
    store.put('b', 'tex-b', bytes(512))
    store.get('a') // 'a' is now the most recent, so 'b' is the victim
    store.put('c', 'tex-c', bytes(512))

    expect(dispose).toHaveBeenCalledWith('tex-b')
    expect(store.get('b')).toBeUndefined()
    expect(store.get('a')).toBe('tex-a')
    expect(store.get('c')).toBe('tex-c')
  })

  it('replaces an entry in place, disposing the old value and rebilling', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 2, dispose })
    store.put('a', 'big', bytes(512))
    store.put('a', 'small', bytes(128))

    expect(dispose).toHaveBeenCalledWith('big')
    expect(store.get('a')).toBe('small')
    expect(store.bytes()).toBe(bytes(128))
  })

  it('refuses a single entry larger than the whole budget rather than emptying itself', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(128), dispose })
    store.put('a', 'tex-a', bytes(128))
    expect(store.put('huge', 'tex-huge', bytes(512))).toBe(false)

    expect(dispose).toHaveBeenCalledWith('tex-huge')
    expect(store.get('a')).toBe('tex-a')
  })

  it('disposes everything on clear, for a lost context', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 4, dispose })
    store.put('a', 'tex-a', bytes(128))
    store.put('b', 'tex-b', bytes(128))
    store.clear()

    expect(dispose).toHaveBeenCalledTimes(2)
    expect(store.size()).toBe(0)
    expect(store.bytes()).toBe(0)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/textures/store.test.ts`
Expected: FAIL — "Failed to resolve import @/textures/store.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/textures/store.ts
type Entry<T> = { value: T; bytes: number }

export type TextureStore<T> = {
  get(id: string): T | undefined
  /** False when the entry is larger than the whole budget; it is disposed, not held. */
  put(id: string, value: T, bytes: number): boolean
  delete(id: string): void
  clear(): void
  size(): number
  bytes(): number
}

/**
 * Byte-budgeted LRU. Generic over its value and disposal so it runs with no GL
 * context: the caller decides that disposing means `.dispose()` on a texture.
 *
 * A Map iterates in insertion order, so re-inserting on read is what makes the
 * first key the least-recently-used one.
 */
export function createTextureStore<T>(opts: {
  budgetBytes: number
  dispose?: (value: T) => void
}): TextureStore<T> {
  const held = new Map<string, Entry<T>>()
  const drop = opts.dispose ?? (() => {})
  let total = 0

  const remove = (id: string) => {
    const entry = held.get(id)
    if (!entry) return
    held.delete(id)
    total -= entry.bytes
    drop(entry.value)
  }

  return {
    get(id) {
      const entry = held.get(id)
      if (!entry) return undefined
      held.delete(id)
      held.set(id, entry)
      return entry.value
    },
    put(id, value, bytes) {
      if (bytes > opts.budgetBytes) {
        drop(value)
        return false
      }
      remove(id)
      while (total + bytes > opts.budgetBytes) {
        const oldest = held.keys().next()
        if (oldest.done) break
        remove(oldest.value)
      }
      held.set(id, { value, bytes })
      total += bytes
      return true
    },
    delete: remove,
    clear() {
      for (const id of [...held.keys()]) remove(id)
    },
    size: () => held.size,
    bytes: () => total,
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/textures/store.test.ts`
Expected: PASS, 5 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/textures/store.ts src/textures/store.test.ts
git commit -m "bound texture memory with an LRU that disposes what it drops"
```

---

### Task 5: Loading and downscaling a texture source

The deep tiers want a 32px or 128px bitmap, and the daemon serves one size.
`createImageBitmap` resizes during decode, so the browser never holds the full
frame for a card that will be five pixels wide. The average color for the
past-the-fade tier comes from the same path at 1×1.

**Files:**
- Create: `src/textures/source.ts`
- Create: `src/textures/source.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/textures/source.test.ts
import { describe, expect, it, vi } from 'vitest'
import { loadBitmap, averageColorOf } from '@/textures/source.ts'

describe('loadBitmap', () => {
  it('asks the decoder for the target edge, not the full frame', async () => {
    const bitmap = { width: 128, height: 128, close: vi.fn() }
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap)
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => 'blob' })

    const out = await loadBitmap('/img/a', 128, { fetch, createImageBitmap } as never)

    expect(fetch).toHaveBeenCalledWith('/img/a')
    expect(createImageBitmap).toHaveBeenCalledWith('blob', {
      resizeWidth: 128,
      resizeHeight: 128,
      resizeQuality: 'medium',
    })
    expect(out).toBe(bitmap)
  })

  it('returns null on a failed response rather than throwing into the frame loop', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, blob: async () => 'blob' })
    const createImageBitmap = vi.fn()

    expect(await loadBitmap('/img/a', 128, { fetch, createImageBitmap } as never)).toBeNull()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('returns null when the decode itself rejects', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => 'blob' })
    const createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed'))

    expect(await loadBitmap('/img/a', 32, { fetch, createImageBitmap } as never)).toBeNull()
  })
})

describe('averageColorOf', () => {
  it('reads the single pixel a 1x1 decode produces', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255])
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data }),
    }
    const canvas = { width: 0, height: 0, getContext: () => ctx }

    expect(averageColorOf({ width: 1, height: 1 } as never, canvas as never)).toEqual({
      r: 10 / 255,
      g: 20 / 255,
      b: 30 / 255,
    })
    expect(canvas.width).toBe(1)
    expect(canvas.height).toBe(1)
  })

  it('falls back to mid grey when the context is unavailable', () => {
    const canvas = { width: 0, height: 0, getContext: () => null }
    expect(averageColorOf({ width: 1, height: 1 } as never, canvas as never)).toEqual({
      r: 0.5,
      g: 0.5,
      b: 0.5,
    })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/textures/source.test.ts`
Expected: FAIL — "Failed to resolve import @/textures/source.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/textures/source.ts
export type Rgb = { r: number; g: number; b: number }

/** Injected so the loader is testable with no browser. */
export type Decoder = {
  fetch: typeof globalThis.fetch
  createImageBitmap: typeof globalThis.createImageBitmap
}

const browserDecoder = (): Decoder => ({
  fetch: globalThis.fetch.bind(globalThis),
  createImageBitmap: globalThis.createImageBitmap.bind(globalThis),
})

/**
 * Decode straight to `edge`, so a card that will be five pixels wide never
 * costs a full-size frame. Null rather than a throw: this runs under a frame
 * loop, where one dead image must not take the wall down.
 */
export async function loadBitmap(
  url: string,
  edge: number,
  decoder: Decoder = browserDecoder(),
): Promise<ImageBitmap | null> {
  try {
    const res = await decoder.fetch(url)
    if (!res.ok) return null
    return await decoder.createImageBitmap(await res.blob(), {
      resizeWidth: edge,
      resizeHeight: edge,
      resizeQuality: 'medium',
    })
  } catch {
    return null
  }
}

/** The past-the-fade tier draws a flat quad in this color instead of a texture. */
export function averageColorOf(
  bitmap: ImageBitmap,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): Rgb {
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return { r: 0.5, g: 0.5, b: 0.5 }
  ctx.drawImage(bitmap, 0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return { r: r! / 255, g: g! / 255, b: b! / 255 }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/textures/source.test.ts`
Expected: PASS, 5 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/textures/source.ts src/textures/source.test.ts
git commit -m "decode a texture straight to its LOD edge"
```

---

### Task 6: The texture manager

Ties tasks 3–5 together: given the LOD each visible item wants this frame, hold
the right texture, downgrade the ones that sank, and drop what left the wall.
Still no three import — it takes an `upload` callback, which is the seam that
keeps this testable.

**Files:**
- Create: `src/textures/manager.ts`
- Create: `src/textures/manager.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/textures/manager.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createTextureManager } from '@/textures/manager.ts'

const flush = () => new Promise((r) => setTimeout(r, 0))

function harness(budgetBytes = 4 * 1024 * 1024) {
  const disposed: string[] = []
  const manager = createTextureManager<string>({
    budgetBytes,
    urlFor: (id) => `/img/${id}`,
    load: async (_url, edge) => ({ value: `tex-${edge}`, bytes: edge * edge * 4 }),
    dispose: (v) => disposed.push(v),
  })
  return { manager, disposed }
}

describe('createTextureManager', () => {
  it('has nothing on the first frame and uploads for the next one', async () => {
    const { manager } = harness()
    expect(manager.textureFor('a')).toBeUndefined()

    manager.sync(new Map([['a', 512]]))
    await flush()

    expect(manager.textureFor('a')).toBe('tex-512')
  })

  it('downgrades an item that sank down the pile', async () => {
    const { manager, disposed } = harness()
    manager.sync(new Map([['a', 512]]))
    await flush()

    manager.sync(new Map([['a', 128]]))
    await flush()

    expect(manager.textureFor('a')).toBe('tex-128')
    expect(disposed).toContain('tex-512')
  })

  it('never upgrades, so a stale frame cannot force a re-decode', async () => {
    const { manager } = harness()
    manager.sync(new Map([['a', 128]]))
    await flush()

    manager.sync(new Map([['a', 512]]))
    await flush()

    expect(manager.textureFor('a')).toBe('tex-128')
  })

  it('drops an item that left the wall', async () => {
    const { manager, disposed } = harness()
    manager.sync(new Map([['a', 128]]))
    await flush()

    manager.sync(new Map())
    expect(manager.textureFor('a')).toBeUndefined()
    expect(disposed).toContain('tex-128')
  })

  it('holds no texture at all for the past-the-fade tier', async () => {
    const { manager } = harness()
    manager.sync(new Map([['a', 0]]))
    await flush()
    expect(manager.textureFor('a')).toBeUndefined()
  })

  it('does not start a second load while the first is in flight', async () => {
    const load = vi.fn().mockResolvedValue({ value: 'tex', bytes: 4 })
    const manager = createTextureManager<string>({
      budgetBytes: 1024,
      urlFor: (id) => `/img/${id}`,
      load,
      dispose: () => {},
    })

    manager.sync(new Map([['a', 32]]))
    manager.sync(new Map([['a', 32]]))
    await flush()

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('disposes everything on a lost context', async () => {
    const { manager, disposed } = harness()
    manager.sync(new Map([['a', 128]]))
    await flush()

    manager.clear()

    expect(disposed).toContain('tex-128')
    expect(manager.textureFor('a')).toBeUndefined()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/textures/manager.test.ts`
Expected: FAIL — "Failed to resolve import @/textures/manager.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/textures/manager.ts
import type { Edge } from '@/textures/ratchet.ts'
import { ratchet } from '@/textures/ratchet.ts'
import { createTextureStore } from '@/textures/store.ts'

export type TextureManager<T> = {
  /** Reconcile against what this frame wants: `id → LOD edge`. */
  sync(want: ReadonlyMap<string, number>): void
  textureFor(id: string): T | undefined
  clear(): void
}

/**
 * Holds one texture per visible item at the edge its rank earned. `load` is
 * injected rather than imported so this runs with no GL context and no browser.
 */
export function createTextureManager<T>(opts: {
  budgetBytes: number
  urlFor: (id: string) => string
  load: (url: string, edge: number) => Promise<{ value: T; bytes: number } | null>
  dispose: (value: T) => void
}): TextureManager<T> {
  const store = createTextureStore<T>({ budgetBytes: opts.budgetBytes, dispose: opts.dispose })
  const heldEdge = new Map<string, Edge>()
  const inFlight = new Set<string>()

  return {
    sync(want) {
      for (const id of [...heldEdge.keys()]) {
        if (want.has(id)) continue
        store.delete(id)
        heldEdge.delete(id)
      }

      for (const [id, requested] of want) {
        const next = ratchet(heldEdge.get(id), requested as Edge)
        if (next === 0) continue
        if (heldEdge.get(id) === next && store.get(id) !== undefined) continue
        if (inFlight.has(id)) continue

        inFlight.add(id)
        void opts.load(opts.urlFor(id), next).then((loaded) => {
          inFlight.delete(id)
          if (!loaded) return
          store.put(id, loaded.value, loaded.bytes)
          heldEdge.set(id, next)
        })
      }
    },
    textureFor: (id) => store.get(id),
    clear() {
      store.clear()
      heldEdge.clear()
      inFlight.clear()
    },
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/textures/manager.test.ts`
Expected: PASS, 7 tests

- [x] **Step 5: Commit**

```bash
cd ~/src/slopboard
git add src/textures/manager.ts src/textures/manager.test.ts
git commit -m "hold one texture per item at the edge its rank earned"
```

---

### Task 7: Install three and react-three-fiber

**Files:**
- Modify: `package.json`

- [x] **Step 1: Install**

Run:
```bash
cd ~/src/slopboard
npm i three@^0.169.0 @react-three/fiber@^9.0.0
npm i -D @types/three@^0.169.0
```

- [x] **Step 2: Verify the versions resolve against React 19**

Run: `cd ~/src/slopboard && npm ls @react-three/fiber react`
Expected: `@react-three/fiber` present with no `UNMET PEER DEPENDENCY` line. R3F v9
is the React 19 line; v8 pins React 18 and will print a peer warning here. If it
does, stop and report rather than forcing it.

- [x] **Step 3: Confirm the existing suite still passes**

Run: `cd ~/src/slopboard && npm run typecheck && npx vitest run`
Expected: typecheck clean, all existing tests pass.

- [x] **Step 4: Commit**

```bash
cd ~/src/slopboard
git add package.json package-lock.json
git commit -m "add three and react-three-fiber"
```

---

### Task 8: The WebGL backend

**Eyes only** — no test asserts what this looks like. Keep it thin: every
decision with a right answer is already in tasks 1–6.

**Files:**
- Create: `src/backends/WebglBackend.tsx`
- Modify: `src/App.tsx`

- [x] **Step 1: Write the backend**

```tsx
// src/backends/WebglBackend.tsx
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import type { WallItem } from '@shared/protocol.ts'
import type { Arrangement3D, SlopChannels } from '@/arrangements/index.ts'
import { toStackItems } from '@/model.ts'
import { defaultParams } from '@/params.ts'
import { createTextureManager } from '@/textures/manager.ts'
import { loadBitmap } from '@/textures/source.ts'

type Props = {
  items: WallItem[]
  arrangement: Arrangement3D
  ttlMs: number
  clockOffset: number
}

/** One quad per item. Ranks past the fade get no texture and draw flat. */
function Wall({ items, arrangement, ttlMs, clockOffset }: Props) {
  const group = useRef<THREE.Group>(null)
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const { gl } = useThree()

  const textures = useMemo(
    () =>
      createTextureManager<THREE.Texture>({
        budgetBytes: defaultParams.textureBudgetBytes,
        urlFor: (id) => `/img/${id}`,
        load: async (url, edge) => {
          const bitmap = await loadBitmap(url, edge)
          if (!bitmap) return null
          const tex = new THREE.Texture(bitmap as unknown as HTMLImageElement)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.needsUpdate = true
          return { value: tex, bytes: edge * edge * 4 }
        },
        dispose: (tex) => tex.dispose(),
      }),
    [],
  )

  // A lost context invalidates every GPU handle; rebuilding from an empty
  // store is the only safe response, and the manager re-uploads next frame.
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      textures.clear()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl, textures])

  useEffect(() => () => textures.clear(), [textures])

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const latest = useRef({ items, ttlMs, clockOffset })
  latest.current = { items, ttlMs, clockOffset }

  const [live, setLive] = useState<string[]>([])

  useFrame(() => {
    const { items, ttlMs, clockOffset } = latest.current
    const now = Date.now() + clockOffset
    const model = toStackItems(items, { now, ttlMs })
    const aspects = new Map(model.map((m) => [m.id, m.aspect]))

    const result = arrangement.strategy.layout({
      items: model,
      container: { w: window.innerWidth / window.innerHeight, h: 1 },
      state: undefined,
      options: { now },
    })

    const wantLod = new Map<string, number>()
    for (const [id, ch] of (result.channels ?? new Map()) as Map<string, SlopChannels>) {
      wantLod.set(id, ch.lod ?? 0)
    }
    textures.sync(wantLod)

    const placed = [...result.placements.keys()]
    if (placed.length !== live.length || placed.some((id, i) => live[i] !== id)) setLive(placed)

    for (const [id, rect] of result.placements as Map<string, Rect>) {
      const mesh = meshes.current.get(id)
      if (!mesh) continue
      const ch = (result.channels?.get(id) ?? {}) as SlopChannels
      const aspect = aspects.get(id) ?? 1
      const side = rect.w

      // The rect is the square slot; the image is letterboxed inside it.
      mesh.scale.set(aspect >= 1 ? side : side * aspect, aspect >= 1 ? side / aspect : side, 1)
      mesh.position.set(rect.x, rect.y, rect.z ?? 0)
      mesh.rotation.set(ch.rotX ?? 0, ch.rotY ?? 0, ch.rotZ ?? 0)

      const mat = mesh.material as THREE.MeshBasicMaterial
      const tex = textures.textureFor(id)
      if (mat.map !== (tex ?? null)) {
        mat.map = tex ?? null
        mat.needsUpdate = true
      }
      mat.opacity = ch.opacity ?? 1
      mat.transparent = true
    }
  })

  return (
    <group ref={group}>
      {live.map((id) => (
        <mesh
          key={id}
          geometry={geometry}
          ref={(m) => {
            if (m) meshes.current.set(id, m)
            else meshes.current.delete(id)
          }}
        >
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function WebglBackend(props: Props) {
  const camera = props.arrangement.camera ?? { fovDeg: 35, z: 1.586 }
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: camera.fovDeg, position: [0, 0, camera.z], near: 0.01, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Wall {...props} />
    </Canvas>
  )
}
```

- [x] **Step 2: Wire the flag into App**

Replace the body of `src/App.tsx` so it picks a backend once and only cycles
arrangements of that backend's dimensionality:

```tsx
// src/App.tsx
import { useEffect, useState } from 'react'
import { useWall } from '@/useWall.ts'
import { arrangementsFor } from '@/arrangements/index.ts'
import { backendFrom } from '@/backend-flag.ts'
import { DomBackend } from '@/backends/DomBackend.tsx'
import { WebglBackend } from '@/backends/WebglBackend.tsx'

// Read once: one backend per window for its life.
const backend = backendFrom(location.search)
const available = arrangementsFor(backend === 'webgl' ? 3 : 2)

export function App() {
  const { items, ttlMs, clockOffset, connected } = useWall()
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' && e.key !== ']') return
      const step = e.key === ']' ? 1 : -1
      setIndex((i) => (i + step + available.length) % available.length)
      setFlash(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(false), 1200)
    return () => clearTimeout(id)
  }, [flash])

  const arrangement = available[index]
  if (!arrangement) return null

  return (
    <>
      {arrangement.dims === 3 ? (
        <WebglBackend
          items={items}
          arrangement={arrangement}
          ttlMs={ttlMs}
          clockOffset={clockOffset}
        />
      ) : (
        <DomBackend
          items={items}
          arrangement={arrangement}
          ttlMs={ttlMs}
          clockOffset={clockOffset}
        />
      )}
      <div className={`hud ${flash ? 'hud--flash' : ''}`}>
        <span className="hud__name">{arrangement.name}</span>
        <span className="hud__count">{items.length}</span>
        {!connected && <span className="hud__offline">offline</span>}
      </div>
    </>
  )
}
```

- [x] **Step 3: Typecheck and run the suite**

Run: `cd ~/src/slopboard && npm run typecheck && npx vitest run`
Expected: typecheck clean, every existing test still passing. No test covers
`WebglBackend` — that is Task 10.

- [x] **Step 4: Commit**

```bash
cd ~/src/slopboard
git add src/backends/WebglBackend.tsx src/App.tsx
git commit -m "draw the wall in WebGL behind a startup flag"
```

---

### Task 9: Live parameter controls

The spec is explicit: "Every constant is a live parameter... Tuning this by
editing source and reloading does not converge." Task 10 is a tuning session, and
without this it is a tuning session with a 2-second reload between every guess.

A `<dat.gui>`-style panel is not worth a dependency. One `<details>` panel of
number inputs over `StackParams` is, because the parameter surface is already
one flat object by design.

**Files:**
- Create: `src/Params.tsx`
- Create: `src/params.paths.ts`
- Create: `src/params.paths.test.ts`
- Create: `src/params.css`

- [x] **Step 1: Write the failing test**

```ts
// src/params.paths.test.ts
import { describe, expect, it } from 'vitest'
import { numberPathsOf, getAt, setAt } from '@/params.paths.ts'

const sample = { a: 1, b: { c: 2, d: 'text' }, e: [3, 4], f: true }

describe('numberPathsOf', () => {
  it('finds every number, however deep', () => {
    expect(numberPathsOf(sample)).toEqual(['a', 'b.c', 'e.0', 'e.1'])
  })

  it('skips strings and booleans, which no slider can edit', () => {
    expect(numberPathsOf(sample)).not.toContain('b.d')
    expect(numberPathsOf(sample)).not.toContain('f')
  })
})

describe('getAt / setAt', () => {
  it('reads a nested value', () => {
    expect(getAt(sample, 'b.c')).toBe(2)
    expect(getAt(sample, 'e.1')).toBe(4)
  })

  it('writes without mutating the original', () => {
    const next = setAt(sample, 'b.c', 99)
    expect(getAt(next, 'b.c')).toBe(99)
    expect(sample.b.c).toBe(2)
  })

  it('keeps an array an array rather than turning it into an object', () => {
    const next = setAt(sample, 'e.0', 9)
    expect(Array.isArray((next as typeof sample).e)).toBe(true)
    expect((next as typeof sample).e).toEqual([9, 4])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd ~/src/slopboard && npx vitest run src/params.paths.test.ts`
Expected: FAIL — "Failed to resolve import @/params.paths.ts"

- [x] **Step 3: Write minimal implementation**

```ts
// src/params.paths.ts
/** Every dotted path in `value` that addresses a number. Array indices are
 *  path segments, so `lod.0.edge` is editable like anything else. */
export function numberPathsOf(value: unknown, prefix = ''): string[] {
  if (typeof value === 'number') return [prefix]
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    numberPathsOf(v, prefix ? `${prefix}.${k}` : k),
  )
}

export function getAt(root: unknown, path: string): number | undefined {
  const out = path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, root)
  return typeof out === 'number' ? out : undefined
}

/** Structural copy along the path only — the frame loop reads this object every
 *  frame, so mutating in place would make a change invisible to React. */
export function setAt<T>(root: T, path: string, value: number): T {
  const [head, ...rest] = path.split('.')
  if (head === undefined) return root
  const src = root as unknown as Record<string, unknown>
  const next: unknown = rest.length === 0 ? value : setAt(src[head], rest.join('.'), value)
  if (Array.isArray(root)) {
    const copy = [...(root as unknown[])]
    copy[Number(head)] = next
    return copy as unknown as T
  }
  return { ...src, [head]: next } as unknown as T
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd ~/src/slopboard && npx vitest run src/params.paths.test.ts`
Expected: PASS, 5 tests

- [x] **Step 5: Write the panel**

```tsx
// src/Params.tsx
import { numberPathsOf, getAt, setAt } from '@/params.paths.ts'
import type { StackParams } from '@/params.ts'
import './params.css'

/** Every number in StackParams, editable live. Tuning by editing source and
 *  reloading does not converge, which is the whole reason this exists. */
export function ParamsPanel({
  params,
  onChange,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
}) {
  return (
    <details className="params">
      <summary className="params__summary">params</summary>
      <div className="params__grid">
        {numberPathsOf(params).map((path) => (
          <label key={path} className="params__row">
            <span className="params__name">{path}</span>
            <input
              className="params__input"
              type="number"
              step="any"
              value={getAt(params, path) ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) onChange(setAt(params, path, n))
              }}
            />
          </label>
        ))}
      </div>
    </details>
  )
}
```

- [x] **Step 6: Write the stylesheet**

```css
/* src/params.css */
.params {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 50;
  max-height: 90vh;
  overflow: auto;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.72);
  color: #e2e8f0;
  font: 11px/1.3 ui-monospace, monospace;
}

.params__summary {
  cursor: pointer;
  user-select: none;
}

.params__grid {
  display: grid;
  gap: 2px;
  margin-top: 6px;
}

.params__row {
  display: grid;
  grid-template-columns: 1fr 72px;
  gap: 8px;
  align-items: center;
}

.params__input {
  width: 100%;
  background: #1a202c;
  border: 1px solid #2d3748;
  color: inherit;
  font: inherit;
  padding: 1px 3px;
}
```

- [x] **Step 7: Hold the params in App and thread them through**

In `src/App.tsx`, hold them in state and pass them to the backend and the panel:

```tsx
  const [params, setParams] = useState(defaultParams)
```

Pass `params` to `<WebglBackend params={params} …/>`, render
`{backend === 'webgl' && <ParamsPanel params={params} onChange={setParams} />}`,
and in `WebglBackend` replace every `defaultParams` read with `props.params`.
`createStack` takes its params at construction, so rebuild the arrangement when
they change:

```tsx
  const arrangement3d = useMemo(() => createStack(params), [params])
```

- [x] **Step 8: Typecheck and run the suite**

Run: `cd ~/src/slopboard && npm run typecheck && npx vitest run`
Expected: clean, all passing.

- [x] **Step 9: Commit**

```bash
cd ~/src/slopboard
git add src/Params.tsx src/params.paths.ts src/params.paths.test.ts src/params.css src/App.tsx src/backends/WebglBackend.tsx
git commit -m "edit every stack parameter live"
```

---

### Task 10: Look at it

The deliverable. Everything above is arithmetic; this is the question the
project exists to answer, and it is the owner's to answer.

- [ ] **Step 1: Run the wall with synthetic traffic**

```bash
cd ~/src/slopboard
npm run dev &
npm run sim -- --rate=2400 --zones=alpha,beta,gamma,delta,epsilon,zeta
```

Open `http://localhost:5173/?backend=webgl`.

- [ ] **Step 2: Judge these, and write the answers into `params.ts`**

Every one is a control in the panel on the wall, so a bad answer is a drag and
not a code change. Open `params` at the top right.

- Does a pile read as depth, or as mush? (`step.z`, `rot.x`/`rot.y`, and
  `camera.projection` — the projection changes this question's answer, so judge
  it under both)
- Is the top card legible at wall distance? (`side`, `camera.wallMargin`;
  `camera.fovDeg` only bites under perspective)
- Does an arrival read as one shove, or as a jump cut? (`shoveMs`)
- Does the pile look grown or machined? (`jitter`)
- Do the piles want to hang from a corner or float in their cells? (`origin`)
- Is there an angle the wall reads better from than head-on? Drag the canvas to
  find it; it lands in `camera.yawDeg`/`pitchDeg`. Framing is computed head-on,
  so expect it to go loose as you turn — that is the known limit in DESIGN.md
  under The stack's camera, not a number to tune away.
- Where does a tier stop being visually free? (`lod` thresholds)
- Does a quiet zone's top card dying in place read as informative or broken?
  (`fade`)

`overlay.zones` and `overlay.labels` draw each zone's extent and name into the
scene, which is the fastest way to see whether a pile has outgrown its cell.

- [ ] **Step 3: Record what the DOM wall could not tell you**

Append the answers to `DESIGN.md` under Arrangements. `DESIGN.md` currently
carries the receding-wall concept as a *candidate*; this is the evidence that
settles it or kills it.

---

## Verification

`npm run typecheck` and `npx vitest run` pass in slopboard. `?backend=webgl`
shows piles that move when the sim runs, `?backend=dom` is untouched, and
`[`/`]` cycles only within the running backend's dimensionality.

## Risks

**R3F v9 against React 19.** v8 pins React 18. Task 7 step 2 is the check; a
peer warning there means stopping rather than forcing, because the failure
mode further in is a renderer that mounts and never updates.

**`createImageBitmap` resize options are not universal.** Safari shipped
`resizeWidth`/`resizeHeight` late. The wall's target is one browser on one
monitor, so this is a note rather than a blocker — but a silent full-size
decode is exactly the VRAM problem the LOD tiers exist to avoid, so check the
decoded `bitmap.width` once by hand if memory looks wrong.

**One mesh per item, not instanced.** The spec floats atlasing the deep ranks
into one draw call, and explicitly says to do it only if a profile asks. This
plan does not. If 200 cards across ten zones drops frames, that is the first
thing to reach for — and it is a renderer change, not a layout one.
