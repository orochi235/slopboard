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

**All layout comes from windease — its strategy layer, not its host.** That core
is substrate-neutral by contract ("implementations must not read or write the
DOM, measure anything, or mutate their inputs"), so `layout()` is a pure function
callable from a rAF loop with no store and no DOM. Arrangements become
`LayoutStrategy` implementations that live here. What windease must *not* supply
is `ContainerHost`: it recomputes on store mutation, so driving it per frame
means ~60 store writes/sec through throttle, history and reconcile.

**Every constant is a live parameter.** Tuning this by editing source and
reloading does not converge. Every number in this document is a starting value.

## Layout contract

An arrangement is a windease `LayoutStrategy`. `Arrangement` shrinks to the
registry metadata windease has no field for — `dims`, `camera` — wrapping one.

The shapes already agree. windease's `layout({ items, container, state, options })`
is what `arrange` is in practice: none of `grid`, `tide` or `erode` reads the `t`
it is handed, because time reaches them through `Item.age01`. `createSlots` /
`createSequencer` are windease's `state` + `reduce` under other names, with the
same drop-tolerance rule.

What a 3D arrangement returns:

```ts
placements: Map<id, Rect>          // { x, y, z, w, h }, world units
channels:   Map<id, SlopChannels>  // { opacity, rotX, rotY, rotZ, saturation?, lod? }
```

Two conversions, each done once per arrangement, and one non-conversion:

**Coordinates.** windease returns container units from the top-left; `Placement`
is 0..1 of the viewport addressing the item's center. Fractional containers work
— 10 zones at `{ w: 16/9, h: 1 }` with `gap`/`padding` of `0.02` tiles to a clean
4×3 with no rounding anywhere.

**State.** `createSequencer` and `createSlots` become the strategy's `state`
plus `reduce` — the same allocators under windease's names, keeping the
drop-tolerance rule they already carry.

**Aspect is not a conversion — emit the square slot.** `Rect` forces w/h where
`scale` was one number, but nothing forces it to be the *image's* w/h. Set `w = h = side` and let
the renderer fit the image inside, as `DomBackend.write()` already does. The Rect
is the box the item is fit inside — which is what `scale` has always meant — so
aspect never crosses into the strategy and `LayoutItem.natural` stays unset.
`aspect` appears nowhere in `src/arrangements/` today except as a field on `Item`
and a comment about it, so this costs nothing to preserve.

Do not instead pass aspect in and have arrangements emit true image w/h. It buys
`overflow`, which is meaningless here (`tide`'s `OVERSHOOT` puts items off-wall
on purpose), and `unplaced`, which has one use at most (the rank cap). The price
is aspect math in every arrangement and aspect fixtures in tests that need none
today. A square slot is also the more forgiving hit-target if drops ever land.

**Channels.** `opacity`, `blur`, `saturation`, the pile's per-`id` rotation and
its LOD tier are not geometry. They ride a new
`LayoutResult.channels?: Map<id, Record<string, number>>` that windease carries
and never reads.

### `z` on `Rect`

`z?: number`, and every windease strategy emits `z: 0` explicitly — so every Rect
the library produces carries it and read sites need no `?? 0`, while hand-built
literals in tests and consumer code keep compiling. Making it required is the
same design with a major version attached; that is the only reason not to.

`0`, never `null`: a 2D layout genuinely *is* at depth zero, so `null` would
encode absence for a value that exists, and it coerces to `0` in arithmetic
silently.

Depth as geometry rather than a channel is a **forward commitment**. By the test
in the next section it would be a channel today — the predicate that makes it
geometry, occlusion-aware drop targets reading depth, does not exist yet. The
library's owner has decided it will.

### What belongs in `channels`, and why it is untyped

Not "the optional fields" — `Rect.z` is optional and is not a channel. Not "what
we hide from windease" — nothing is being withheld. **Channels is output windease
has no predicate over.** Every question its core asks is a predicate over
geometry: does this fit (`overflow`), did it get placed (`unplaced`), what is
under the cursor (`contains`), which seam is this (`bounds`), what is to the left
(`navigate`). A number that could appear in one of those is geometry. A number no
such question exists for is a channel. Opacity is the clear case. Rotation is the
boundary one — a tight OBB hit-test would read it — so it stays a channel until
something needs that test, not forever by decree.

**The abuse to avoid:** channels is not where things windease does not support
yet get smuggled. If the core should reason about a number and cannot, extend the
core. Channels is for numbers where extending it would be *wrong*.

This closes an asymmetry rather than inventing a bag. windease already carries
consumer-defined data it never interprets — `membership.placement`'s free-form
keys on the input side, and `Affordance<TMeta>.meta` on the output side, where
`LayoutResult<TId, TMeta>` already threads the generic. Affordances get it;
placements get nothing. Channels reuses the parameter that is already there.

Typing it would hand windease a vocabulary it has no business owning. Its other
consumer manages panes, where `saturation` means nothing — as it means nothing on
a plotter or in a terminal. Every name is permanent under semver. Worst, a typed
`opacity` invites "shouldn't a fully transparent item count as `unplaced`?", and
layout semantics start depending on a rendering property. An opaque bag makes
that question unaskable. `number` rather than `unknown` is the one assumption
worth making: cross-fade is a blind lerp of every channel by `id`, which works
only if they are all numbers.

The cost is real. No key-name safety, and `opacty` fails silently at the
renderer. slopboard declares its own `SlopChannels` and casts once at the
boundary, so the safety sits with whoever owns the vocabulary.

The purity constraint from `DESIGN.md` survives as windease's own: `layout` is
recomputed each frame, motion closed-form, any per-`id` cache droppable.

## World units

**z = 0 is the plane where the 3D backend reproduces 2D framing exactly** —
visible height 1.0, `scale` meaning what it means today. A perspective camera at
FOV 35° sits on +Z at `0.5 / tan(fov/2)`.

This convention is the whole reason porting the 2D arrangements later is
mechanical: `{ x, y, z: 0, w, h }` renders identically.

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

Take the strategies, plus `observePixelRatio` (backing-store resize on a DPR
change, which moving a window between displays needs). Do **not** take `Store` or
the focus stack — the per-frame objection above, and a second one that outlives
it: `navigableLeaves(store, geometry)` wants windease to be the zone model, its
nodes carry their own lifecycle FSM, and the daemon already owns item lifetime.
Two owners of "when does this exist" will disagree. Arrow keys across a known
grid is ~20 lines. Widening later is additive.

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

**windease becomes co-designed with slopboard.** Taking all of layout, not just
the zone grid, means `channels` and `Rect.z` exist in a window-management library
because an ambient wall wanted them — a permanent commitment to a consumer whose
other user manages panes. Keeping `channels` opaque is the whole mitigation: it
adds a pipe rather than a schema. The wall also inherits a new way to break, and
windease's README carries unreleased breaking changes right now (none touching
`gridStrategy`'s signature or its unit-container behavior).

## Decided against

| Considered | Verdict |
|---|---|
| One scene graph, DOM backend projecting it | Its advantages are all about keeping two backends in sync, and 2D is not staying. CSS 3D also sorts occlusion per-element, which is wrong for exactly the heavy-overlap pile this builds. |
| Lightbox in WebGL, camera flying to a card | Structurally cheap once the camera moves, but WebGL and DOM disagree on color management, so the handoff to real pixels pops. |
| Depth from `age01` (continuous drift) | Spacing would then encode arrival timing: bursts clump, quiet spells gap. |
| Slow automatic camera drift for parallax | Motion nobody asked for, on a monitor nobody is watching. |
