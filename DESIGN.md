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

### Asking to be looked at

An item can ask for attention, and an agent sets the flag whenever it tells a
person to go and look at something. That makes it common rather than rare,
which is the constraint the treatment is designed against: a wall where a third
of the cards shout is a wall where none of them do.

**One strength, 0..1, drives every cue**, so they cannot drift apart. It is a
step and not a ramp — the flag is live or it is not — computed on the daemon's
clock for the same reason `age01` is, so a reload does not restart a hold.

- **It does not recede.** Emphasis floors the `distance` falloff rather than
  being applied after it, so burying a flagged card can dim it no further than
  the flag allows. This is the cue that still works an hour later, when the
  card is at rank 20.
- **It stands out of its pile**, by a world-space lift in front of its own
  front rank, applied at the mesh beside the other position corrections.
- **It wears a halo** in `colors.attention`, reusing the per-card line that
  `overlay.cardEdges` drives. The halo wins the line where both want it: a
  flagged card is not also reporting its slot extent.
- **It breathes.** A scale pulse, amplitude scaled by emphasis, so an unflagged
  card is exactly as still as it ever was. This costs nothing extra: the canvas
  has no `frameloop` prop, so r3f is on `always` and the wall already redraws
  every frame.

**A flag ends by being dismissed or by lapsing, never by the card expiring.**
A hold of null holds until someone dismisses it; any other hold lapses on its
own. Either way the card goes on living out its TTL as an ordinary card.

### How depth reads

Two things say "this card is far back," and they are deliberately different
senses of far: **rank** is how buried a card is in its pile, and **age** is how
close it is to expiry. A busy zone buries a card in minutes; a quiet one holds
its second card for a day. So both earn a curve.

**Detail falls off with rank, and so does presence.** The LOD tiers already
drop a card from 512 to 128 to 32 to a flat colour chip as it is buried, which
means depth read as *loses detail* and nothing else — a buried card came out
blocky and at full luminance at once, and turned off head-on the deep tail was
the brightest thing on the wall. `distance` is the other half: presence falls
across a rank window to `distance.floor` and stops there. Never to zero, because
an invisible tail is a shorter pile rather than a deeper one.

The window is in **ranks, not world z**, so it keeps its meaning while `step.z`
is tuned, and so it lines up with the tiers that already divide the pile.

**How the two curves meet is a live control**, because it is a judgment and not
a fact. `ceiling` scales age's presence by depth's, so they compound and a card
that is both deep and old is dimmer than either alone; `min` takes whichever is
dimmer, which holds a deep card at the floor and hides its fade until age drops
past it. Both end at nothing for a fully expired card — they only disagree while
a fade is running. `distance.enabled` off is the wall before any of this.

**A foreign card in a zone's cell is dim because it is deep.** `step.x`/`step.y`
walk a pile diagonally out of its own cell as rank grows — past two card widths
by rank 40 — so a card only reaches a neighbour's cell by trailing there in z.
The falloff therefore dims exactly the intruders while sparing every zone's
front ranks, and the confusion of a stranger's panel reading as local is a
symptom of the missing falloff rather than its own problem.

**The fade and distance curves are swappable from code and are not parameters.**
`createStack` takes an optional pair of functions. `StackParams` round-trips
through localStorage and the clipboard as JSON, where a function does not
survive, so a curve shape cannot live there. Nothing in the repo passes them.

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
  budget nothing. The backdrop sits a hair behind the zone outline rather than
  behind the pile: it writes no depth and draws ahead of the cards, so it never
  occludes them however deep they go, while a plane parked at the deepest rank
  parallaxes away from its own border as soon as the wall turns.
- **Zone chrome is drawn on the pile's base card, not on what it has drawn.**
  Outline, backdrop, label and the plan view all use `baseCellsOf`, so a tall
  pile does not claim more of the wall than its neighbour. The camera is the
  exception and still frames the union, because that is what is on screen.
- **The sky is shaded by the camera's orientation, not its projection.** A
  full-screen quad whose vertices are already clip coordinates, so it cannot be
  clipped by the orthographic slab, picked, or made to occlude a card — it is
  behind everything by render order. The view ray comes from a spread of its
  own (`sky.spreadDeg`) rather than the camera's fov, because an orthographic
  camera's rays are parallel: borrowing the real projection samples one
  direction and paints the screen flat. So turning the wall turns the sky and
  zooming does not move it, whichever projection is in use. No animation,
  because a breathing background is decoration competing with the cards. Not
  for the cost: the canvas sets no `frameloop`, so r3f is on `always` and the
  wall already redraws every frame whether or not anything moved.
- **A raw shader writes sRGB, so its colours must not be converted.** three
  takes an authored hex into its linear working space on the way in and its
  built-in materials convert back on the way out; a `ShaderMaterial` writing
  `gl_FragColor` does neither, so `Color.set` renders several stops too dark.
  `srgb()` in `sky.ts` keeps the value raw. The zone hatch still uses
  `Color.set` and reads darker than its palette entry says.
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
~/src/slopboard/bin/slop --caption "the sky, turned" render.png
some-generator | ~/src/slopboard/bin/slop --zone renders
~/src/slopboard/bin/slop --print-zone     # the one implementation of the rule
```

Ask `slop` for the zone rather than deriving it. A caller that sanitizes the
repo name slightly differently binds the repo to a second, adjacent zone, and
the wall shows the split without ever reporting an error.

**Provenance is written, not asked for.** An instruction to stamp metadata is
the kind that fails silently and stays failed — nothing about a render looks
wrong when the field is missing, so compliance drifts. `bin/slop` is the
chokepoint every render already passes through, so it writes what it can see
(the repo and the commit it ran in) with no cooperation at all, and takes the
one thing only the caller knows as an argument: `--caption`. An argument fails
in front of whoever typed it.

It rides in a `<image>.slop.json` sidecar rather than the filename, which is
where the TTL rides: a caption holds spaces and slashes, and the name is not
durable anyway — expiry renames a file to `<id>-<zone>`, dropping even its
extension. The sidecar is written **before** the image, because the image
landing is what the watcher triggers on; written after, it would lose the race.
It follows its image into the trash.

**A sidecar answers the caption outright; the filename is read only without
one.** Since `bin/slop` names its copy with a UUID, a fallback to the name
would caption a piped render with a hex string — worse than no caption. So a
sidecar with no caption means the CLI had nothing to say, and the wall shows
nothing. A file dropped in by hand has no sidecar, and its name is the only
thing it says.

**`--attention` is the second thing only the caller knows.** It rides the same
sidecar as a raw token — `look`, `30m`, `look:90s`, `until-dismissed` — and the
daemon parses it at ingest into a level and a hold. A token it cannot read is
warned about and dropped rather than guessed at, so a typo never becomes a flag
at the default strength, and `shout` does not start working by accident the day
a second level is added.

The level is a name from the first commit even though only one exists, which is
what makes a second treatment a row in the params table it drives rather than a
change to this contract. **A flag is not a reprieve:** it changes how loudly an
item is drawn and never how long it lives, which is what `--ttl` is for.

**The daemon folds the stamp into the image's own XMP at ingest**, both into the
cache derivative and into the original — `/orig` serves the original, and it is
the copy that leaves the wall, where no store is around to ask. **PNG only for
the original:** writing metadata means re-encoding, which is lossless for a PNG
and a silent quality loss for anything else, so a JPEG keeps its bytes and goes
unstamped. The caption is written to `dc:description` as well as the private
`slop:` namespace — but note that macOS does not surface a PNG's XMP
description in Spotlight or Get Info, so the standard field is for the
Adobe-family and `exiftool` readers, not for Finder.

**Ingest is capped at `config.ingestAtOnce`, which bounds buffers rather than
threads.** sharp already runs libvips' own pool at one thread per core and
queues the rest, so an unbounded fan-out was never a parallel decode per file —
its cost was holding every pending full-resolution buffer alive at once.
Adopting an 85-file inbox peaks at 549MB uncapped against 469MB at a cap of 3
(410MB against 330MB for the largest single process), and the gap grows with
the inbox rather than staying flat. `SLOP_INGEST_AT_ONCE` overrides it so the
ceiling can be measured instead of argued about.

Stamping restores the file's **mtime** afterwards. `adopt` derives `bornAt`
from mtime precisely so a restart cannot resurrect the wall, so a stamp that
bumps it re-ages every item the daemon re-adopts — and with `tsx watch`
restarting on every server edit, nothing would ever expire while the server is
being worked on.

**The wall is the default in every repo, not something a repo opts into.** Each
harness `CLAUDE.md` says renders go to `bin/slop` and not to Preview, so a repo
is on the wall the first time it renders — no install, no registration, nothing
to forget when a repo is created. Per-repo binding was the earlier model and
scaled the wrong way: eighty repos meant eighty standing instructions to write
and to keep, and repo eighty-one was silently invisible until someone noticed.
The skill (`skills/slopboard/`, symlinked into the harness skill directories)
now only writes the exceptions — Preview back for one repo, or a zone name that
isn't the directory's.

**Zones self-register, because the daemon needs a path the image doesn't carry.**
A zone colored by its project's `.hued` means mapping a zone back to a working
copy, and the inbox holds only the images. So `bin/slop` writes
`~/slop/zones/<zone>.json` recording the directory it ran in, on every send.
One file per zone rather than a shared registry: two concurrent sends both
read-modify-writing one JSON file lose each other's entry, and the failure looks
like a zone that intermittently forgets its color. A record whose directory has
gone, or that is caught half-written, drops that zone's color and never the
others'.

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
| `zoneGrid.padding` | Retired. windease insets the cells correctly, but a card's size comes from `side` in world units, so cards do not shrink with their cells: raising it moved the anchors together while the cards stayed put, and the piles collided. `camera.margins[0]` already owns breathing room around the wall, in the one place that survives framing the union. |
| HTML/React artifacts on the wall, not just images | Rejected. A CSS3D or iframe layer means no depth sorting against WebGL planes, no shared fade, no texture control, and arbitrary JS running on the wall. If HTML artifacts want a wall, they want a different one. |
| The zone backdrop as tinted glass, shading what sits behind it | Rejected. Dropping the backdrop's `renderOrder = -1` would let it sort by its own z and tint everything behind — but at `BACKDROP_Z` that is the zone's own pile from rank 1 back, not just the strangers, and at a `backdropOpacity` of 0.5 it is a wash rather than a hint. Sparing the home pile needs per-zone masking or a stencil. The `distance` falloff answers the same complaint per-card and tunably, so the plane stays a background. |

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
