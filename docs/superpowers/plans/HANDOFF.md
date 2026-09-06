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

## Attention flags and the wall's chrome — shipped

All on `main`; `git log --oneline 27be480..HEAD` is the list. An agent flags an
artifact it wants looked at, and the wall says so.

`slop --attention <level>[:<hold>] --note "why"`. Levels are `look`, `soon`,
`urgent`, `problem` — presets, not a scale, because a serious problem and a
deadline are different kinds of asking. Only `soon` lapses on its own; the rest
hold until dismissed, and opening the artifact dismisses it. A badge appears
only where there is a note; no level name is ever substituted. DESIGN.md carries
the design under **Asking to be looked at** and in the ingest contract.

**Vocabulary changed mid-session: it is an "artifact", not an "image."** The
wall may hold other types later. Prose touched since carries the new word.

Also landed, and worth knowing before touching the same ground:

- **An artifact's id is derived from its source path**, not minted per ingest.
  A random id meant every daemon restart renamed every artifact and blanked the
  wall. See the trap below before testing anything about `/img`.
- **Badges are planes in the artifact's own frame**, not sprites, so they turn
  with the wall. `attention.badgeSize` is the height of *one line*.
- **Zone names climb the cell's left edge**, turned a quarter turn, with
  `zones.labelOffset` and `labelAlign` to place them.
- **Seven vendored faces**, chosen separately for badges and zone labels
  (`typeface.badge`, `typeface.label`). No OCR-B — every port has murky
  provenance and none was worth a binary on a guess.
- **A parallax modal on `?`** — seven planes at real translateZ, pointer-driven,
  silent under `prefers-reduced-motion`.

### The whole outstanding list

The user's instruction is to work all of it, not just the head.

**The sidebar, which is one feature in four parts:**

- A floating translucent sidebar for HUD elements the corner chrome cannot hold.
- In it, a list of every flagged artifact and what its badge says.
- In it, a debug panel that generates test cases — one button throwing every
  attention level onto random stacks. **Build this first whatever else happens:**
  the badge-collision item cannot be judged without producing the overlap on
  demand.
- The params panel becomes an item on the sidebar. It is the corner panel and
  the prefs sheet today, both rendering the same `ParamsBody`, so a third host
  is a third caller and not a rewrite. Decide whether the corner panel retires —
  two routes to the same controls was already one more than the wall needed.

**Then, unblocked by the above:**

- **Badges collide when flagged artifacts sit near each other in a pile.** The
  sidebar list decides whether the fix is "fan them all out" or the much cheaper
  "show the frontmost and let the list carry the rest."

- **A right-click context menu built out of the parallax layers**, on a zone, a
  pile or a card. The modal on `?` is the visual language to reuse — the same
  perspective and translateZ deck, sized down to a menu. The pick that decides
  *which* of the three was hit already exists: `chainAt` in `WebglBackend`
  returns the full path under the pointer, `[zone]` or `[zone, id]`, and returns
  `[]` over empty sky. So the menu's targeting is a read of that, not new
  raycasting.

**Independent of the sidebar:**

- **The client cannot tell the daemon died.** The other half of the hot-reload
  bug and the one still live. It is receive-only over a socket vite proxies, so
  the browser end stays open when the upstream goes: the wall reports itself
  connected and silently misses every arrival and expiry. Stable ids mean this
  no longer blanks the wall, only freezes it. A boot id in the snapshot that the
  client re-checks is the shape that was considered, not decided.
- **The wall costs a core whenever it is open.** No `frameloop` prop, so r3f is
  on `always` and nothing idles. DESIGN.md used to claim the opposite; that line
  is corrected. Matters for a display meant to run all day.
- **Enter should descend a rung**, the inverse of Escape.
- **View state in the URL hash**, so a reload keeps the view. It already
  survives reloads somehow — find out how before adding a second mechanism.
- **The lightbox wants the artifact's age above the image.** Its caption sits at
  the bottom today.
- **Panel expand/collapse should persist** in localStorage.
- **Zone sort order** shipped as direction along each axis (`zoneGrid.reverseX`
  / `reverseY`). If the ask meant the sort *key* — by name, artifact count,
  recency — that is still unbuilt and does not conflict with what is there.
- **"also tomorrow"** — an unresolved fragment of a message. Ask before acting.

### Judgment calls waiting on the wall

Every number here is a slider, so a bad answer is a drag, not a code change.

- **Pulse is off** — `attention.pulse` is a master gain at 0. Rate climbs with
  level underneath it; nobody has watched it move.
- **`urgent` is `#ff8000`**, the one plate that is not pure-channel, because
  orange cannot be. Magenta would complete the set and separate urgent from
  problem, which are adjacent hot hues today. Noticed, not proposed.
- **Zone label headroom is vertical only**, so a long name may crop once the
  label sits outside the cell. Not checked against a long one.
- **Typeface defaults to Oxanium** for both uses, unjudged.

### Traps this cost real time

- **`/img` is served `immutable`.** A plain `fetch` to check whether an id still
  resolves answers **200 from the browser's own cache** and hides everything.
  Every probe needs `cache: 'no-store'`. This produced two wrong conclusions in
  a row before it was caught.
- **Editing anything under `shared/` or `server/` restarts the daemon**, because
  `tsx watch` follows imports. Confirm with the worker pid
  (`pgrep -f preflight.cjs`), not the supervisor's, which never changes.
- **The devtools browser is a different profile from the user's.** Its
  `localStorage` params are not theirs; state read there says nothing about what
  they see. Chasing that wasted a round of colour "bugs" that were never real.
- **Every open copy of the wall costs a core**, so leaving a driven browser on
  the page is not free.

### One loose thread in the inbox

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
