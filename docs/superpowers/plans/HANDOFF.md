# Where the 3D wall stands

For whoever picks this up next. The plans are the reference and `DESIGN.md`
holds what was decided; this only carries what neither can — session state and
the traps that cost time.

## Done

Plans 1, 2 and 3 are implemented and on `main` in both repos, except the two
**eyes-only tuning tasks** — the last task of each plan. Those are deliberately
still unticked, because their deliverable is a judgment.

- windease `main`: `Rect.z` (required), `LayoutResult.channels`, both wired
  through `ContainerHost` and the presets.
- slopboard `main`: the WebGL wall behind `?backend=webgl`, texture LOD with a
  byte budget, camera zoom, arrow navigation, the lightbox, and — since the
  plans were written — an orthographic default, corner-anchored piles, an
  orbiting camera you drag, a slider panel over every parameter, a clickable
  plan view, and in-scene zone outlines and labels.

Both repos are green; `npm test` in each is the count, and it is current in a
way a number written here stops being the moment anyone commits.

Since the plans, also on `main`: a per-item TTL written into the filename
(`name.ttl5m.ext`, bare number is seconds, wall default now 24h and `sim` tags
its own cards `ttl60`); a port guard on both halves (a taken 8787 attaches to a
live daemon or names `SLOP_PORT` and exits 1, instead of an unhandled error
event; the client has its own port 5183 with `strictPort`); params persisted to
localStorage and movable by clipboard or file; the hierarchy walked by wheel,
pinch and click over a path-based view, and by WASD wherever the arrows go; a
zone presenting itself with an outline, a label and a hatched backdrop on its
base card; `params.colors` as the wall's whole palette, which a zone can
override with the colour of the project bound to it; and a sky behind
everything.

Since then, still on `main`: WASD navigates wherever the arrows do; a caption
and the writing repo's commit ride into every render's XMP through a
`<image>.slop.json` sidecar `bin/slop` writes; ingest is capped; the zone
backdrop sits on its border instead of behind its pile; and `zoneGrid.padding`
is retired. `git log --oneline` from `6fc3f8e` covers the lot, and each commit
message carries the reasoning that is not in the diff.

Read `DESIGN.md` under **The stack's camera** before touching the camera or the
arrangement. It carries the one thing that is not visible in the code: a pile
is a volume — deeper than the whole wall is tall at 29 cards — and every box
computed about it is flat, because windease's `Rect` has a z position and no z
extent. That is why framing goes loose once you turn the camera off head-on.

## Attention flags — shipped, and what is still open

Four commits, `30839c9` → `eeaa43e`, all on `main`. An agent flags an artifact
it wants looked at; the wall says so and lets you jump to it.

`slop --attention <level>[:<hold>] --note "why"`. Levels are `look`, `soon`,
`urgent`, `problem` — presets, not a scale, because a serious problem and a
deadline are different kinds of asking. Only `soon` lapses on its own; the rest
hold until dismissed, and opening the artifact is what dismisses them. DESIGN.md
carries the design under **Asking to be looked at** and the ingest contract.

**Vocabulary changed mid-session: it is an "artifact", not an "image."** The
wall may hold other types later. Code and docs touched since carry the new word;
older prose does not.

### Judgment calls waiting on the wall

Every number below is a slider, so a bad answer is a drag.

- **Badges lie in their artifact's plane** and may run past its right edge as
  far as the next zone starts. `badgeSize` is the height of *one line*, so a
  wrapped note grows taller rather than shrinking its text.
- **Typeface.** `Oxanium` is the default, with Orbitron, Nova Square, two Firas
  and the system mono in the dropdown. Vendored as woff2 — no OCR-B, because
  every port has murky provenance and none was worth a binary on a guess.
- **Pulse is off** (`attention.pulse` is a master gain at 0). Rate climbs with
  level underneath it; nobody has watched it move.
- **Every plate is inked black.** Even pure red measures better against black
  (5.25:1) than white (4.00:1). One ink for four plates.
- **`urgent` is `#ff8000`**, the one plate that is not pure-channel — orange
  cannot be. Magenta would complete the set and separate urgent from problem,
  which are adjacent hot hues today. Not proposed, just noticed.
- **Zone names are 3× and climb the left edge.** Their headroom is vertical
  only, so a long name may crop; the camera has not been checked against one.

### Asked for and not built

A sidebar is the next chunk, and three of these are one feature:

- **A floating translucent sidebar**, holding HUD elements the corner chrome
  cannot.
- **In it, a list of every flagged artifact** and what its badge says. This is
  most of the answer to the item below it — enumerate them in a fixed panel and
  a badge in the scene no longer has to stay individually legible when several
  pile up.
- **In it, a debug panel that generates test cases**, one button throwing every
  attention level onto random stacks. Build this first whatever else happens:
  the stacking question below cannot be judged without a way to produce the
  overlap on demand.
- **Badges collide when flagged artifacts sit near each other in a pile.**
  Unsolved, and deliberately not solved yet — settle the sidebar list first,
  because it decides whether the fix is "fan them all out" or the much cheaper
  "show the frontmost, let the list carry the rest."

Unrelated to the sidebar, in rough priority:

- **Hot reload empties the wall until a hard reload.** Not diagnosed — do not
  guess at it. The daemon restarts on any `shared/` edit, which is a plausible
  cause and unproven; the client's reconnect should re-snapshot and apparently
  does not. This is the one with a user watching it.
- **Enter should descend a rung**, the inverse of Escape.
- **View state in the URL hash**, so a reload keeps the view. It already
  survives reloads somehow — find out how before adding a second mechanism.
- **The lightbox wants the artifact's age above the image.** Its caption sits
  at the bottom today.
- **"also tomorrow"** — an unresolved fragment of a message. Ask before acting.

### One loose thread in the inbox

`2FCBA0D9-…ttl48h.png` sits in `~/slop/inbox/slopboard/` while its sidecar sits
in `~/slop/trash/`. The artifact is live on the wall with its caption and
provenance stranded. `trashStamp` moves a sidecar to follow its artifact, so
only the sidecar moving is a path nothing accounts for. Unexplained.

## Asked for and not built

Three things. The depth question is answered; what it settled is below it.

### How depth read on this wall — answered and built

`distance` is in `params.ts`: presence falls across a rank window to a floor,
combined with the temporal fade by a rule that is itself a live control
(`ceiling` compounds the two, `min` takes the dimmer). DESIGN.md under
**How depth reads** carries the design; the tinted-glass backdrop is in the
rejected table with the reason.

`172fc14` stands — nothing about `renderOrder` changed. The falloff dims a
stranger's panel because reaching a neighbour's cell requires depth, so the
occlusion complaint went with it.

Defaults are `to: 22, floor: 0.12, combine: 'ceiling'`, tuned by eye against the
live wall in one pass and worth a second opinion — the four renders are on the
wall, captioned, showing before, the first guess at `to: 60` and the tuned set.
The mid-ranks of a big pile (`weasel`, `slopboard`) are still fairly bright and
that may or may not be right.

### Stats in the bottom-left corner

Asked for: VRAM, GPU and FPS on screen. Designed in conversation, approved by
nobody, built not at all.

**Two of the three are not available to a web page.** There is no VRAM query in
WebGL — no total, no free, no per-context usage — and `performance.memory` is
the JS heap and Chrome-only. GPU time per frame needs
`EXT_disjoint_timer_query_webgl2`, which Chrome ships disabled in most contexts.
What is gettable: FPS and frame time from the frame loop; **the wall's own
texture bytes against its budget**, which `createTextureStore` already accounts
exactly and is a truer number than the browser would give; `renderer.info` for
draw calls, triangles, textures and programs; and the GPU name once from
`WEBGL_debug_renderer_info`, often masked. Label the memory line `tex`, not
`vram`, so it does not claim to be what it is not.

The shape agreed in conversation: a block stacked above `.hud` rather than rows
inside it, so the HUD keeps its flash-on-change behaviour; sampling every frame
but repainting the DOM at about 4Hz, since text layout at 60Hz costs more than
the readout is worth; FPS as a rolling average, not an instantaneous
reciprocal; behind `overlay.stats`. It is lab chrome, so it is the first thing
the `?lab` decision below should retire.

### Wear weasel's themes — the decision is yours

**Should the wall's own furniture go violet?** Weasel's accent is a midnight
violet where slopboard's is cyan, so a scene that follows the theme repaints
every card outline, every zone label and the sky. Following it in the DOM chrome
only changes almost nothing you can see, because the panel's hand-picked darks
already sit within a hair of weasel's. So "does the scene follow the theme" is
not a side question about a bridge — it is the whole question.

Both options were rendered to the wall as `theme-options`, A above B, and the
branch `spike/weasel-theme` is **parked on purpose**: `?theme=weasel` is A,
`?theme=weasel-scene` is B, and it is the only place `@weasel-js/theme` is
installed. Its mapping of token to palette entry is one plausible reading, not
a design.

What the spike settled: `resolveTheme(theme, mode)` is pure, DOM-free, and hands
back a concrete `#hex` per token, so the scene needs no `getComputedStyle` and
no CSS parse. `@weasel-js/theme/react` publishes the same record as
`useTheme().resolved`, for precisely this case. The bridge is not the work.

Two things the ask did not know. `tokens.css` also sets `:root { font-family:
Oswald; font-weight: 300 }`, so importing it re-types the whole wall and not
only its colours. And a second fork waits behind the first: whether a theme
**replaces** `params.colors` or only **seeds** it. `mergeStored` lays a stored
tuning over the defaults, so a theme that merely seeds them is outranked forever
by any entry the panel has ever touched, and a mode flip never reaches it.

### Make the page a lab

The params panel, the minimap and the HUD are developer chrome that a real wall
display should not carry. The ask is to name that: this page is the lab, and a
non-lab wall comes later. No decision yet on the mechanism — a `?lab` flag
beside `?backend`, a separate route, or a build-time split — and that decision
is the first thing to settle.

### Also parked

`spike/cell-relative-side` renders `side` as a fraction of the zone's cell
rather than a world constant (`?side=cell`), scaling the pile's step and jitter
to match. Both readings were rendered to the wall as `side: world constant vs
fraction of the cell, at 6 columns`, at six columns because that is where they
diverge. Adopting it means re-tuning `side` once and re-reading what the `lod`
tiers mean, since rank-to-edge was calibrated against a card of stable size. It
leaves `step.z` absolute, so a deep pile still trails past its cell either way.

## Do this first

Run the wall and answer the questions in
[the renderer plan's Task 10](2026-09-02-webgl-renderer.md) and
[the interaction plan's Task 7](2026-09-02-webgl-interaction.md):

```bash
cd ~/src/slopboard && npm run dev
npm run sim -- --rate=2400 --zones=alpha,beta,gamma,delta,epsilon,zeta
open 'http://localhost:5183/?backend=webgl'
```

Every question there is a control in the `params` panel, so a bad answer is a
drag and not a code change. When the numbers settle, write them into
`src/params.ts` — or copy the whole tuned set to the clipboard from the panel,
which pastes straight into that file.

More has arrived unlooked-at than those two tasks ask about: the gesture rail's
two thresholds and its cooldown (`nav`), the hatch backdrop's spacing, width
and angle, and every `sky` knob. All are guesses that have never been judged
against a moving wall.

**The client and the daemon are owned by different things right now.** A memory
squeeze killed vite one morning while the daemon rode it out, so the client was
restarted by hand from a session rather than by the original `npm run dev` —
`concurrently` is still running its daemon leg alone. Expect the wall's page to
go dark whenever whichever session started vite exits, while the daemon keeps
ingesting. `npm run dev:client` brings the page back on its own; a full
`npm run dev` also works, because the daemon leg finds 8787 taken, attaches and
exits 0.

To run against a daemon other than the one serving the real wall, set
`SLOP_ROOT` and `SLOP_PORT` on both the daemon and the client — `vite.config.ts`
points its proxy at `SLOP_PORT`. Without that the sim writes into `~/slop/inbox`
and its cards show up on the real wall for a TTL.

## Traps already paid for

- **`DomBackend` ignores a per-item TTL.** It computes `age01` inline from the
  wall default, where the WebGL path goes through `toStackItems` and honours
  `i.ttlMs`. So a `ttl60` card fades on the 2D backend as though it had a day,
  then vanishes when the sweeper takes it. One line, if that backend still
  matters.
- **Rewriting a file in the inbox re-ages the wall.** `adopt` reads mtime so a
  daemon restart cannot resurrect anything, so anything that rewrites an
  original — the XMP stamp does — has to put mtime back. It did not at first,
  and with `tsx watch` restarting the daemon on every server edit the effect
  was that nothing expired for a whole night.
- **slopboard builds `windease` from source, so which branch that checkout is
  on is part of every result here.** The vite and vitest aliases both point at
  `~/src/windease/src`. Check which branch that checkout is on before trusting
  a green suite or a render as a statement about windease `main` — it has been
  on a feature branch during this work at least once.

- **A `Rect`'s x/y is its top-left, everywhere windease emits one.** The card
  mesh read it as a centre, which hung every pile half a card up and left of its
  cell. three positions a plane by its centre, so the correction belongs at the
  mesh and nowhere else.
- **Perspective empties the corners of whatever it frames.** Deep ranks converge
  toward the screen axis, so dead space at the edges of the wall is the
  projection, not the margins. Orthographic is the default for this reason.
- **`Texture.flipY` does nothing for an `ImageBitmap` source.** three only
  applies it to an `HTMLImageElement`, so the flip happens at
  `createImageBitmap` instead. Every card renders upside down without it, and
  the obvious fix is the one that does not work.
- **Framing the container crops the wall.** A pile's deep ranks step past its
  cell, so the camera frames the union of what is drawn (`zoneCellsOf` /
  `unionOf`), not `{ w: aspect, h: 1 }`.
- **The camera must retarget from the frame loop.** Zone cells are unknown until
  the first layout has run, so framing only on a view change parks the camera at
  a fallback pose forever.
- **Changing a param must not rebuild the arrangement.** `createStack` closes
  over its params and resets its rank allocators, so keying the memo on the
  whole object reshuffles every pile on every frame of a camera drag. It is
  keyed on the layout half alone.
- **`pkill -f 'tsx watch server'` kills the real wall's daemon, not just yours** —
  and killing the daemon child takes `concurrently` and vite down with it. A
  taken 8787 is now handled: the daemon attaches to a live one and exits 0, so
  a second `npm run dev` gives you a client against the running daemon.
- **`bin/slop` renames every file to a UUID**, so the filename cannot carry a
  caption — and expiry renames it again to `<id>-<zone>`, without even an
  extension. Captions and provenance now travel in a `<image>.slop.json`
  sidecar the daemon folds into the image's XMP; see `DESIGN.md` under the
  ingest contract. The sidecar must be written before the image, or it loses
  the race against the watcher.
- **A raw shader must not let three convert its colours.** `Color.set` takes an
  authored hex into the linear working space, and a `ShaderMaterial` writing
  `gl_FragColor` never converts back, so the value renders several stops too
  dark. `srgb()` in `sky.ts` is the fix; the zone hatch still has the bug and
  reads darker than its palette entry claims.
- **The client is on 5183, not vite's 5173.** Other projects on this machine
  take 5173 first, and `strictPort` makes that a loud failure rather than a
  silent drift to a port nobody opens.

## Not done

Plan 2's risk list still stands: one mesh per item rather than instanced or
atlased, and zoom does not promote an LOD tier — the ratchet refuses to grow a
texture, so a zoomed pile shows deep cards at the edge their rank earned.

Added since: framing knows a pile's footprint and not its depth, so a turned
wall reads loose. The decision that unblocks it — whether a card or a zone gets
real thickness — is an open question in `DESIGN.md`, not an oversight.

All three are follow-ups with a profile or a complaint as the trigger.
