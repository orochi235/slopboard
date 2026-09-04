# slopboard

A wall for AI-generated renders, filling a side monitor. Images arrive from
agents, live for a while, then disappear unless rescued.

This is the design doc: what it is, what's decided, and what's still open. It
assumes no prior context.

## The thesis

Most software defaults to hoarding. Every generated image lands in a folder that
becomes archaeological sediment. slopboard inverts that: **ephemeral by default,
permanence earned by an act of attention.** Roughly 90% of what lands here is
slop, and the name is a reminder not to let this drift into being an asset
manager.

The problem it replaces: agents were told to open renders in Preview. Preview
steals focus constantly, and most renders aren't worth looking at.

## Architecture

**Daemon** (Node)

- `chokidar` watches `~/slop/inbox/`, with `awaitWriteFinish` on — see Traps.
- Subdirectory name = zone ID.
- `sharp` downscales on ingest to 1024px longest edge; the original path stays
  in metadata for click-through.
- `express` serves the static bundle and the images.
- WebSocket pushes `{ id, url, zone, bornAt, w, h }` per arrival, and a full
  snapshot of live items on connect.

The daemon owns item lifetime. Clients are pure views: they receive `bornAt` and
derive age locally against a server-supplied clock offset. A client reload
therefore changes nothing about what is on the wall or how far along it is.

**Client** (React, served in the browser)

Two render backends (see Arrangements): a DOM/CSS backend, and an r3f backend
for arrangements that place in three dimensions — which is not the same as
perspective, and by default is not perspective at all (see The stack's camera).
They no longer share one layout interface — 3D arrangements run only in the r3f
backend, and the DOM backend is a legacy escape hatch that goes away if the 3D
wall works. See `docs/superpowers/specs/2026-09-02-webgl-backend-design.md`.

Run it chromeless:

```
open -na "Google Chrome" --args \
  --app=http://localhost:5173 \
  --user-data-dir=/tmp/slopboard
```

The separate profile keeps it out of the main browser's process pool so it
doesn't get tab-discarded under memory pressure.

## Arrangements

An arrangement is how images enter, move over their life, and leave. Which one
reads well on a monitor you are not looking at is genuinely unknown, so
arrangement is a swappable strategy rather than a decision baked into the
renderer.

### The interface

```ts
type Item = {
  id: string
  aspect: number      // w/h
  age01: number       // 0 at arrival, 1 at expiry
  zone: string
  pinned: boolean
  hovered: boolean
}

type Placement = {
  id: string
  x: number, y: number      // 0..1 of viewport
  scale: number             // relative to a reference cell
  depth: number             // 0 = front, 1 = back
  opacity: number
  blur?: number
  saturation?: number
}

type Arrangement = {
  name: string
  dims: 2
  arrange(items: Item[], viewport: Size, t: number): Placement[]
}
```

3D arrangements are a different contract — a windease `LayoutStrategy` returning
rects and channels, described in the WebGL spec, not here.

```ts
```

`arrange` is pure and recomputed each frame. Three things follow, and they're
the reason for the shape:

- Swapping arrangements live is free.
- Cross-fading two arrangements is lerping two `Placement` lists by `id`, so
  comparison is a smooth A/B rather than a jump cut.
- `depth` is a z-index in the DOM backend. It was meant to be a Z position in
  the r3f one so that a single arrangement ran in both; that did not survive
  contact with real perspective, and 3D arrangements are now r3f-only.

The constraint this imposes: motion must be a closed-form function of age, not
accumulated velocity. Springs are fine (a damped spring has a closed form);
arbitrary physics is not. An arrangement may cache per-`id` derived values, but
must tolerate that cache being dropped at any time.

That cache is not optional in practice. A stable per-item slot cannot be derived
from a pure `arrange` call: any index into a sorted list shifts when an item
arrives (newest-first) or expires (oldest-first), moving every neighbour.
`slots.ts` holds the two allocators that need — monotonic for `tide`'s lanes,
lowest-free for `erode`'s cells.

An arrangement that holds position constant must also make sure position does
not smuggle age in anyway: filling cells in raster order packs the top rows
newest-last, which is a decay gradient nobody asked for. `erode` maps slots
through a coprime stride so a partly-full wall scatters.

### The set

Seven, spanning the space. Each is roughly 40 lines, so the point is to have
them all and throw most away. `stack` is 3D and runs only in the r3f backend;
the rest are 2D.

| Name | Mechanic | What it tests |
|---|---|---|
| `grid` ✅ | Newest first in reading order, oldest falls off the end. No decay signal. | Control. Everything else has to beat this. |
| `tide` ✅ | Enter at one edge, drift at constant velocity across the wall, exit the far edge. Position *is* age. Size constant throughout. | Whether one coherent slow motion field reads better than N independent fades. Periphery is good at coherent motion. |
| `recede` | Enter at the front plane, move back in Z, shrink and fade with distance. | The original concept. Now a candidate rather than an assumption. |
| `settle` | Enter at the top, fall to a resting position, pack downward as items leave from the bottom. | Gravity as decay. The bottom row means "going soon" without saying so. |
| `erode` ✅ | Position fixed for life. Decay is desaturation, then blur, then dissolve. Zero motion. | Whether motion is needed at all, or whether a still wall is calmer and just as legible. |
| `spiral` | Enter at the perimeter, spiral inward, vanish at the center. | Centripetal reading, and whether a convergence point is restful or maddening. |
| `stack` | One diagonal pile per zone, tiled to a grid. Depth is rank: an arrival shoves the pile back. Only the top of each pile is legible. | Whether the wall is better as "which repos are producing" plus a zoom, rather than N readable images. |

### The stack's camera

`stack` is the only 3D arrangement, so the camera belongs to its design rather
than to the renderer.

**A pile is a volume, and nothing models it as one.** Its depth is
`rank × step.z` — 0.035 world units a card, against cards 0.22 on a side and a
wall 1.0 unit tall. A pile is deeper than a card is wide at 7 cards, deeper than
the entire wall is tall at 29, and `rankCap` 200 allows seven walls. Every box
computed about it is nonetheless flat: the zone cell, the framed union, the plan
view rect. windease's `Rect` carries a z position and no z extent, so a layout
can say where in depth something sits and never how deep it is. Head-on that
costs nothing, because a footprint is all a head-on camera needs. It stops being
free the moment the camera leaves head-on, which is what the orbit added —
framing sees a pile's front face and not the length of it, so a turned wall
reads loose.

**Orthographic by default.** Perspective was the original assumption and it
fails on geometry rather than on taste: deep ranks converge toward the screen
axis, so the far corners of whatever box the camera frames are empty by
construction, and the wall shows dead space at the top and right whatever the
margins say. Under an orthographic projection the framed union is the drawn
union. Perspective stays available as `camera.projection`, because the two
answer *does a pile read as depth or as mush* differently and that question is
still open.

**Piles hang from a corner.** `origin` is where a pile meets its cell: the same
relative point of the card meets that point of the cell, so 0,0 is corner to
corner and 0.5,0.5 centres. Top-left by default, which is what lines up the top
and left edge of every pile on the wall.

**The camera orbits.** `camera.yawDeg`/`pitchDeg` place it around what it
frames, and dragging the canvas turns the scene by writing those same two
params, so the angle has one home rather than two. Framing itself is stated once
as a half-height; perspective derives a distance from it, orthographic parks at
`camera.standoff` and drives the frustum.

### Walking the hierarchy

The view is a **path**, not a level: `[]` is the wall, `['weasel']` a pile with
focus, `['weasel', 'img-1']` a card. `reduceView` only climbs and lands, so a
rung added later costs it nothing. What a rung *means* — which box the camera
frames, whether it draws in the scene or raises an overlay — stays with the
renderer, which has to be taught a new rung's geometry regardless.

**One rung per gesture, and either across or down, never both.** Wheel, pinch
and click all spend themselves through `stepToward`, and inward targets whatever
is under the cursor rather than whatever has focus. A cursor over a different
pile spends the step moving there; only the next one descends, so the camera
never arrives somewhere the eye did not watch it travel. Reachable mostly at the
wall: once a pile has focus the framing leaves little of its neighbours on
screen, which is what the arrows and the plan view are for.

**A pinch is a wheel event with `ctrlKey` set.** macOS reports a trackpad pinch
nowhere else, so the two are one handler at two scales — pinch deltas run an
order of magnitude smaller, which is why `nav` carries a threshold for each.
Without `preventDefault` the page zooms instead of the wall, and without the
cooldown one flick of momentum walks the whole hierarchy.

**A pile is picked by hit-testing its cell, not by a plane in the scene.** An
invisible plane per cell has to sit behind the deepest card `rankCap` allows or
it steals the card picks, which puts it several world units back and
parallax-shifted the moment the camera turns. Hit-testing the cells answers for
a pile with no cards in it too.

**`camera.margins` holds one entry per rung**, the last serving every rung past
it. Arrows are read by rung the same way: across the zone grid at a pile, and
front to back through the pile itself inside a card, clamping at both ends.

### Entry behavior is a separate axis

Arrivals landing at full presence is the wall's loudest event, and arrivals are
mostly slop — so the design spends its whole attention budget on the least
valuable moment. `bloom` is a modifier, composable with any arrangement: new
items enter dim and small and ramp to full presence over the first ~10% of their
life. The wall stops flinching every time a render drops.

Keep it a flag, not an arrangement of its own. Both settings of it need testing
against every arrangement.

### Evaluating them

- `[` / `]` cycle arrangements; the name flashes briefly in a corner.
- Changes cross-fade over ~1s.
- `bloom` toggles independently.
- **Every stack parameter is a live control** — sliders, selects and toggles in
  a panel on the wall. Tuning by editing source and reloading does not converge,
  which is the whole reason it exists. The answers get written back to
  `src/params.ts` once they settle.
- **A plan view** in the corner names each zone, lights the one with focus, and
  zooms to a pile when clicked.
- **The `zones` group** owns how a zone presents itself: outline, label, and a
  backdrop filling its cell — a ruled hatch by default, drawn by a shader in
  world space so it holds one density across the wall and costs the texture
  budget nothing. The backdrop sits behind the deepest card its pile has
  reached, which is only known per frame, or the pile's deep ranks disappear
  into it.
- **Zone chrome is drawn on the pile's base card, not on what it has drawn.**
  Outline, backdrop, label and the plan view all use `baseCellsOf`, so a tall
  pile does not claim more of the wall than its neighbour. The camera is the
  exception and still frames the union, because that is what is on screen.
- **Preferences have two surfaces** — the corner panel and a modal on `,` —
  rendering one `ParamsBody` so they cannot drift while prefs is still a copy
  of params.
- **`colors` is the wall's whole palette**, ten entries driving both halves: the
  scene reads them as `THREE.Color`, and `applyColors` writes them to the root as
  custom properties for the DOM chrome. Alpha variants are `color-mix` in the
  stylesheets, so one entry covers every use of a colour rather than one entry
  per declaration. This is the surface a theme would drive.
- **A tuned set moves by clipboard or by file.** The clipboard is the fast path,
  since what it holds pastes into `src/params.ts`; the file is for keeping named
  sets. Import goes through `mergeStored`, so a stale or hand-edited blob loses
  its unknown keys and its mistyped values rather than corrupting the panel.
- **Sim mode** synthesizes fake arrivals at a dialable rate from a fixture
  directory. This is the important one: it lets a 200/hour wall be evaluated in
  three minutes instead of by waiting for one. It does not answer what the real
  rate *is* — only living with it does that — but it decouples the layout
  question from that wait.

### Pinned items

Pinned items freeze their `age01` and move to a reserved band; the flowing set
arranges in the space that's left. One rule that works for every arrangement,
rather than an independent "reflow around a hole" packing problem per
arrangement.

## Ingest contract

Agents write files to `~/slop/inbox/<zone>/`. That is the entire integration
surface — any agent that can write a file already works.

Directory names are the source of truth for which zones exist. A config file, if
one ever appears, may only decorate a zone that already exists by name (display
label, color, memory budget). If a zone needed a config entry to show up, an
agent writing to a new one would produce silently invisible images, which is the
worst available failure for a system whose whole promise is "just write a file."

```sh
~/src/slopboard/bin/slop render.png       # zone defaults to the repo name
some-generator | ~/src/slopboard/bin/slop --zone renders
~/src/slopboard/bin/slop --print-zone     # the one implementation of the rule
```

Ask `slop` for the zone rather than deriving it. A caller that sanitizes the
repo name slightly differently binds the repo to a second, adjacent zone, and
the wall shows the split without ever reporting an error.

**Binding a repo** is a skill (`skills/slopboard/`, symlinked into the harness
skill directories). It writes a standing instruction into the repo's
uncommitted `CLAUDE.local.md` telling future agents to send renders here and to
stop opening them in Preview — which is the point, but note it deliberately
overrides the global "always open the image" preference inside that repo, and
nowhere else. `~/slop/bindings.json` records what is bound so unbind can reverse
it exactly; it is a record, never the source of truth for agent behavior.

## Rescue, expiry, and the trash

**Saving is capacity-bounded.** The keep set holds N (start at 12). Keeping
something when the set is full means choosing what it displaces. Without a bound,
"permanence earned by attention" collapses into one click and forever, and one
click is not attention — you get the sediment folder back with extra steps.

**Expiry moves to a holding trash, and it's kept for 24 hours.** The real loss
mode is being heads-down for 40 minutes, not glancing up as something dies; a
10-minute trash catches almost none of those and only feels like a safety net.

**The most recent expiry is undoable with a keystroke**, which covers the case
the trash doesn't: seeing it go and wanting it back immediately.

**Hover pauses decay.** Otherwise things vanish while you're looking at them.

**Never show a countdown.** No numbers, no ticking. If the wall reads as "act now
or lose this," everything gets pinned defensively and you are back to sediment.
The arrangement carries decay peripherally or it doesn't work.

## Traps

**Partial writes.** `chokidar` fires `add` on file creation, not completion, so a
streaming write hands `sharp` a truncated PNG. `awaitWriteFinish` is mandatory —
the `slop()` helper above is exactly this case. Without it a fraction of images
arrive corrupt, intermittently, and it is miserable to diagnose later.

**Texture memory is budgeted in bytes, not count.** A 2048² RGBA texture is 16MB
and a 2048×512 is 4MB; a per-zone item cap bounds nothing. Evict against a byte
budget, add ~33% for mipmaps, and explicitly `.dispose()` evicted textures — GC
will not reclaim them. A few hundred full-res textures will exhaust VRAM and take
the compositor with them: stutter, then black planes, then a hang.

**WebGL context loss.** A backgrounded app window can lose its GL context even
with a separate profile. Without a `webglcontextlost` handler the wall goes black
overnight and reads as a crash. Handle it and rebuild.

**Idle.** As described the wall renders at 60fps forever at a monitor nobody is
watching. Drop to a low tick when nothing is animating and no pointer is present.

**`res.sendFile` ignores dotfiles by default**, so serving the cache out of
`~/slop/.cache` 404s every image with no hint as to why. Both file routes pass
`{ dotfiles: 'allow' }`.

**An empty model unwinds the view to the wall.** The focused zone is pruned
when it stops appearing in what the daemon sends, and a websocket reconnect
sends nothing for a frame — so a dropped connection reads as the wall spontaneously
zooming out. Harmless and self-correcting, and indistinguishable from a bug.

**Serve images as URLs, never over the socket.** Push paths; let the client
fetch. That gets HTTP caching and off-main-thread decode via `createImageBitmap`.
Base64-over-WebSocket hitches every time a render lands.

## Rejected

| Considered | Verdict |
|---|---|
| Preview + `open -g` | Stopgap only. `-g` stops the focus theft today, but windows still pile up. |
| Electron | Rejected. Its only real advantage was non-activating floating windows over the work area, and a full-monitor wall never comes forward. Would still need the same daemon. |
| Swift + Metal | Rejected for now. WebGL already goes through ANGLE onto Metal; GPU isn't the bottleneck. The interaction model is unsettled and React hot-reload beats a renderer rewrite. |
| Core Animation instead of Metal | Noted for a future native port. `CALayer` + `CATransform3D` + `sublayerTransform` gets a receding wall with no renderer. Metal is overkill at a few hundred quads. |
| Native `NSPanel` hosting `WKWebView` | Only if cards ever need to float over the primary display. Correct window semantics, keeps React, ~200 lines of Swift written once. |
| File System Access API (no daemon) | Rejected. No change notification, so you'd poll on an interval and re-consent every browser restart. The daemon is less code. |
| HTML/React artifacts on the wall, not just images | Rejected. A CSS3D or iframe layer means no depth sorting against WebGL planes, no shared fade, no texture control, and arbitrary JS running on the wall. If HTML artifacts want a wall, they want a different one. |

## Open questions

- **Arrival rate.** Gates everything downstream. At 3/hour there is no packing
  problem, no memory problem, no zones, and the whole arrangement layer is
  decoration. At 200/hour the wall is a blur and nothing reads at any depth.
- **Which arrangement, and with `bloom` or without.** The point of building six.
- **Default TTL.** Unknowable until the wall has been live for a day.
- **Does anything on the wall have thickness?** Every primitive is a flat plane
  today — cards, zone outlines, labels — while a pile occupies a volume many
  times the wall's own height. Two separable calls. Whether a *card* gets
  thickness is ours alone: `SlopChannels` is slopboard's own vocabulary that
  windease carries and never reads, so a depth channel costs nothing upstream.
  Whether a *zone* gets a depth is a change to windease's `Rect`, and is the one
  that would let the camera frame a pile instead of its front face. Neither is
  needed while the wall is read head-on.
- **Multi-monitor.** Does a zone ever span displays, or is one board one screen?

## Running it

```
npm install
npm run dev                                   # daemon :8787 + client :5183
npm run sim -- --rate=600 --count=40          # arrivals/hour; count 0 = forever
SLOP_TTL=90 npm run dev                       # seconds; default 300
```

`sim` writes real files into `~/slop/inbox/<zone>/` in chunks, so it exercises
the whole path an agent would — including the partial-write guard.

## Build order

1. ~~Daemon + snapshot-on-connect + `grid` arrangement over the DOM backend.~~ **Done.**
2. ~~Sim mode.~~ **Done.**
3. Point one agent at `~/slop/inbox/` and live with it for a day. This answers
   arrival rate, which decides whether 4 and 5 are worth building at all.
4. r3f backend, `stack`, and zones — designed in
   `docs/superpowers/specs/2026-09-02-webgl-backend-design.md`. Zones arrive
   here rather than last, because one pile per zone is what `stack` is.
5. The remaining 2D arrangements (`recede`, `settle`, `spiral`), `bloom`,
   cross-fade. Only if the DOM backend survives step 4 — otherwise they are
   ported to 3D or dropped. `tide` and `erode` are in, and `[` / `]` cycles.
6. Rescue, expiry, trash, undo.

Steps 1–3 are cheap and answer most of the open questions.
