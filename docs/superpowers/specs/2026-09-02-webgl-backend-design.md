# WebGL backend and per-zone stacks

Design for slopboard's r3f backend and the first 3D arrangement. For whoever
implements it; assumes `DESIGN.md` has been read and does not restate it.

The question it answers: what does the arrangement interface look like once
placement is genuinely three-dimensional, and where do zones live.

## What changes about the product

Today the wall is one flat set of images. After this it is a grid of piles, one
per zone — meaning one per bound repo. Each pile is a diagonal corridor
receding from the camera, spaced tightly enough that the projection compresses
it into a fringe of overlapping edges: the newest item or two are legible and
the rest are depth.

That is a different wall. **At wall level it answers "which repos are
producing"; the zoom answers "what did it make."** Legibility of any individual
image at wall level is explicitly not a goal, which is what makes a pile of 200
acceptable.

## Decisions

**3D arrangements run only in the WebGL backend.** `dims: 2 | 3` replaces
`needs3d`, making `Arrangement` a tagged union — a boolean cannot discriminate
two `arrange` return types, and the registry filters on it. Consequence:
cross-fade is within-backend only.

**The backend is a startup flag** (`?backend=webgl`), not a live toggle. One
backend per window for its life, so the DOM wall and the 3D wall can run on two
monitors at once. `DomBackend` is now a legacy escape hatch on the way out: if
the 3D wall works, it is deleted, and `grid`/`tide`/`erode` are ported or
dropped. Nothing new should be built for it.

**Depth is rank, not age.** An arrival lands at the near end and shoves the pile
one step deeper. Spacing stays exactly even at any arrival rate, and the wall's
only motion is one shove per arrival.

`age01` drives only opacity — an item fades out as it approaches expiry,
*wherever it happens to sit*. The two signals correlate at a busy rate (old is
deep) and come apart at a quiet one, where the top card visibly dies in place.
That is informative rather than a bug: nothing new has arrived and the newest
thing is expiring.

**Zone tiling comes from windease.** Its layout core is substrate-neutral by
contract ("implementations must not read or write the DOM, measure anything, or
mutate their inputs"), and its README already documents a single-WebGL-context
host.

**Every constant is a live parameter.** Tuning this by editing source and
reloading does not converge. Every number in this document is a starting value.

## Interfaces

`Placement` and the 2D path are untouched.

```ts
type Placement3D = {
  id: string
  pos: [number, number, number]   // world units
  rot: [number, number, number]   // euler XYZ, radians
  scale: number                   // world side of the box the image fits inside
  opacity: number
  saturation?: number
}

type Arrangement3D = {
  name: string
  dims: 3
  camera?: Camera                 // unset today; the scene falls back to the default
  arrange(items: Item[], viewport: Size, t: number): Placement3D[]
}
```

`scale` keeps its 2D meaning — the side of the square the image fits inside,
with the mesh applying aspect — so the two placement types stay readable
against each other.

The purity constraint from `DESIGN.md` carries over unchanged: `arrange` is
recomputed each frame, motion must be closed-form in `t`, and any per-`id`
cache must tolerate being dropped.

## World units

**z = 0 is the plane where the 3D backend reproduces 2D framing exactly** —
visible height 1.0, `scale` meaning what it means today. A perspective camera at
FOV 35° sits on +Z at `0.5 / tan(fov/2)`.

This convention is the whole reason porting the 2D arrangements later is
mechanical: `pos = [x, y, 0]` with the same `scale` renders identically.

## Zone tiling

Group live items by `Item.zone`. Feed one `LayoutItem` per zone to
`gridStrategy.layout({ items, container: { w: aspect, h: 1 }, state: undefined,
options })` and get a `Map<zoneId, Rect>` back in those same units — verified:
10 zones at a unit container yields a 4×3 grid with `gap`/`padding` in container
units, and `orientation: 'tall'` transposes it. Each rect becomes a pile's
origin and footprint in the z ≈ 0 plane.

Zone → cell assignment uses the existing `createSlots()` lowest-free allocator
keyed by zone name, so **a zone never moves once placed.** Alphabetical would
reshuffle the entire wall the first time an agent writes to a new repo, and
muscle memory is worth more than tidiness.

Take `gridStrategy` and `observePixelRatio` (backing-store resize on a DPR
change, which moving a window between displays needs). Do **not** take `Store`
or the focus stack: `navigableLeaves(store, geometry)` wants windease to be the
zone model, its nodes carry their own lifecycle FSM, and the daemon already owns
item lifetime — two owners of "when does this exist" will disagree. Arrow keys
across a known grid is ~20 lines. Widening later is additive.

## The stack arrangement

Per zone, rank items newest-first. `pos = origin + rank * step`, where `step`
points down, right, and away from the camera. `scale` is constant — perspective
does the shrinking, which is the point of building this at all. Constant yaw and
pitch angle the cards enough to show edges rather than concentric squares, plus
deterministic per-`id` jitter so the pile is not mechanically perfect.

**The shove has to be animated or every arrival is a jump cut**, and it cannot
accumulate velocity. So a third allocator joins `slots.ts`:

```ts
createRanks(): (ids: string[], now: number) => Map<string, { rank: number; prevRank: number; changedAt: number }>
```

giving `z = lerp(prevRank, rank, ease((now - changedAt) / shoveMs))`. Closed-form
in `now`, and dropping the cache snaps to target for one frame — the same
contract `createSlots` and `createSequencer` already honor.

Rank only ever increases *while the item's neighbours live*: an item enters at 0
and sinks as arrivals push it back. Nothing is promoted toward the camera except
by the user zooming in. That one-way property is what the texture strategy below
exploits.

The exception a reader will hit: expiry is by age, not by depth, so an item can
die out of the middle of a pile at a quiet arrival rate. `createRanks` recomputes
from the live set, so the items behind it shift one step *forward* — the same
interpolation running in reverse. The pile closes up; it does not leave a hole.

## Textures and GL hygiene

A stacked pile does not need most of any image kept warm, and the one-way rank
property above is what makes that safe to exploit. **Texture resolution is a
function of projected screen size, which at wall level means rank.**

| Where | Edge | Bytes each |
|---|---|---|
| Top of pile (legible) | 512 | ~1.4 MB |
| Mid pile (a visible sliver) | 128 | ~87 KB |
| Deep pile | 32 | ~5.5 KB |
| Past the fade band | none — flat quad in the image's average color | 0 |

Average color comes free from the 1×1 mip, and at those depths the pile reads as
a gradient of colored edges, which says "there is history here" at least as well
as mush does.

An item therefore only ever needs its texture to get *smaller* over its life, so
the downgrade path never re-decodes at a larger size: dispose the large texture,
upload the small one from the bitmap already in hand. Drop the source blob after
upload — the daemon serves `/img/:id` as immutable with a one-year max-age, so a
re-fetch is a local cache hit.

The exception is zooming into a stack, which enlarges deep items and is the only
thing that promotes an LOD. Re-decode on zoom-in is acceptable there: it is an
explicit user act, and blur-then-sharpen is what every map does.

Consider atlasing the deep ranks into one texture — it kills per-texture
allocation overhead and lets the tail draw instanced in one call. Worth doing
only if draw calls actually show up in a profile.

Not doing: cropping stored textures to the visible edge strip. The strip is
geometrically stable, so it would work, but jitter and rotation vary which strip
shows and LOD already takes the win.

Byte-budgeted LRU with explicit `.dispose()` on eviction, and a
`webglcontextlost` handler that rebuilds. Both are traps `DESIGN.md` already
names; neither is optional. With LOD in place the budget is a backstop rather
than the thing that shapes the design.

## Lightbox

A DOM overlay serving `/orig/:id`, cross-faded in. No hero transition.

Full resolution is the one thing the lightbox is for and the one thing a texture
cannot afford — a 6000×4000 render is 96 MB as RGBA in VRAM, against a browser
`<img>` that costs the budget nothing. It also keeps right-click → save, copy,
drag-to-Finder and true 1:1 inspection, all of which a GL quad destroys.

So slopboard keeps a DOM layer; it just stops having a DOM *wall*. This does not
conflict with deleting `DomBackend`.

## Camera and interaction

The camera is view-layer state, owned by neither the arrangement nor a constant,
eased between two levels:

- **wall** — all piles framed
- **stack** — one pile filling the frame

Click a pile to zoom to it (pointer raycast); once zoomed, arrow keys walk to
neighboring piles without returning to wall level; Escape returns. Zoom-to-stack
and any future zoom-to-card are the same primitive.

## Parameters

One object, every value live-editable, no constants in the render path: step
vector, jitter magnitude, yaw/pitch, rank cap, shove duration and easing, far
fade band, grid `cols`/`rows`/`gap`/`padding`/`orientation`, camera FOV and both
zoom levels, the LOD rank thresholds and their edge sizes, and the byte budget.

## Testing

`arrange` is pure, so the numbers are unit-testable with no GL context: rank
ordering, even spacing, shove interpolation at both endpoints, cache-drop
snapping to target, zone stability across an added zone, rank cap. The renderer
itself is verified by looking at it.

## Risks

**VRAM is no longer the binding constraint, but the LOD thresholds are
unmeasured.** Per zone the tiered budget is roughly 2×512 + 6×128 + a long tail
at 32, about 3.3 MB; ten zones is ~33 MB, against ~280 MB if every item were
kept at 512. The numbers to verify are where each tier stops being visually
free — that is a looking-at-it question, not a measuring one.

**slopboard becomes windease's second consumer** after brainhouse, which is the
best available test of that API and also a new way for the wall to break.
windease's README carries unreleased breaking changes right now.

## Decided against

| Considered | Verdict |
|---|---|
| One scene graph, DOM backend projecting it | Its advantages are all about keeping two backends in sync, and 2D is not staying. CSS 3D also sorts occlusion per-element, which is wrong for exactly the heavy-overlap pile this builds. |
| Lightbox in WebGL, camera flying to a card | Structurally cheap once the camera moves, but WebGL and DOM disagree on color management, so the handoff to real pixels pops. |
| Depth from `age01` (continuous drift) | Spacing would then encode arrival timing: bursts clump, quiet spells gap. |
| Slow automatic camera drift for parallax | Motion nobody asked for, on a monitor nobody is watching. |
