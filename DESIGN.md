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

Two render backends over one layout interface (see Arrangements): a DOM/CSS
backend, and an r3f backend for arrangements that need real perspective.

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
  needs3d: boolean
  arrange(items: Item[], viewport: Size, t: number): Placement[]
}
```

`arrange` is pure and recomputed each frame. Three things follow, and they're
the reason for the shape:

- Swapping arrangements live is free.
- Cross-fading two arrangements is lerping two `Placement` lists by `id`, so
  comparison is a smooth A/B rather than a jump cut.
- `depth` is a z-index in the DOM backend and a Z position in the r3f one, so
  the same arrangement runs in both and the render-layer choice stops being a
  fork in the road.

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

Six, spanning the space. Each is roughly 40 lines, so the point is to have them
all and throw most away.

| Name | Mechanic | What it tests |
|---|---|---|
| `grid` ✅ | Newest first in reading order, oldest falls off the end. No decay signal. | Control. Everything else has to beat this. |
| `tide` ✅ | Enter at one edge, drift at constant velocity across the wall, exit the far edge. Position *is* age. Size constant throughout. | Whether one coherent slow motion field reads better than N independent fades. Periphery is good at coherent motion. |
| `recede` | Enter at the front plane, move back in Z, shrink and fade with distance. | The original concept. Now a candidate rather than an assumption. |
| `settle` | Enter at the top, fall to a resting position, pack downward as items leave from the bottom. | Gravity as decay. The bottom row means "going soon" without saying so. |
| `erode` ✅ | Position fixed for life. Decay is desaturation, then blur, then dissolve. Zero motion. | Whether motion is needed at all, or whether a still wall is calmer and just as legible. |
| `spiral` | Enter at the perimeter, spiral inward, vanish at the center. | Centripetal reading, and whether a convergence point is restful or maddening. |

### Entry behavior is a separate axis

Arrivals landing at full presence is the wall's loudest event, and arrivals are
mostly slop — so the design spends its whole attention budget on the least
valuable moment. `bloom` is a modifier, composable with any arrangement: new
items enter dim and small and ramp to full presence over the first ~10% of their
life. The wall stops flinching every time a render drops.

Keep it a flag, not a seventh arrangement. Both settings of it need testing
against all six.

### Evaluating them

- `[` / `]` cycle arrangements; the name flashes briefly in a corner.
- Changes cross-fade over ~1s.
- `bloom` toggles independently.
- **Sim mode** synthesizes fake arrivals at a dialable rate from a fixture
  directory. This is the important one: it lets a 200/hour wall be evaluated in
  three minutes instead of by waiting for one. It does not answer what the real
  rate *is* — only living with it does that — but it decouples the layout
  question from that wait.

### Pinned items

Pinned items freeze their `age01` and move to a reserved band; the flowing set
arranges in the space that's left. One rule that works for all six arrangements,
rather than six independent "reflow around a hole" packing problems.

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
- **Multi-monitor.** Does a zone ever span displays, or is one board one screen?

## Running it

```
npm install
npm run dev                                   # daemon :8787 + client :5173
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
4. The remaining arrangements (`recede`, `settle`, `spiral`), `bloom`,
   cross-fade. r3f backend when the first `needs3d` arrangement lands.
   `tide` and `erode` are in, and `[` / `]` cycles.
5. Rescue, expiry, trash, undo.
6. Zones.

Steps 1–3 are cheap and answer most of the open questions. Resist starting at 4.
