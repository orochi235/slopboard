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
- slopboard `main`: the WebGL wall — now the only wall — texture LOD with a
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

### The sidebar, the band and the badges — shipped

All on `main`, unpushed (`main` has no upstream). `git log --oneline fb029be..HEAD`
is the list, and each message carries the reasoning that is not in the diff.

**The sidebar** is a translucent column on the right, toggled by `\`, holding
the flag list, the debug generator and the params controls. It **starts
closed** — that plus the retired corner panel is why the first look after
pulling reads as "nothing arrived". The `‹` tab at the right edge is the other
way in.

**The debug generator** (`fakeFlags` in `src/debug-flags.ts`) throws all four
levels across eight random artifacts. The fabricated flags are merged over
`props.items` inside `WebglBackend`, so a fake reaches the badges, `chainAt`
and `hoverAt` by exactly the route a real one does and nothing downstream
branches on it. The daemon has no record of one, so the row's × and the
open-dismisses-it effect clear it locally before firing the POST a real flag
needs.

**Badges no longer collide.** A plate with a clear spot stays welded to its
card and draws no line; one that would land on another plate hunts the emptiest
nearby screen space and runs a leader line home. That ordering is three prices,
not three rules — `seekPlateCost`, `seekLineCost`, `seekPull` — so all of it is
a drag. A plate is sprung to its spot and will not leave one unless another
beats it by `seekHysteresis`; both were needed, because easing alone makes an
oscillation smooth rather than gone.

**The filter band** across the top: a histogram of when everything landed with
weasel's two-thumb `RangeSlider` over it, plus named buckets. An excluded
artifact is **dimmed where it stands**, never removed — the arrangement never
sees the filter, so nothing reshuffles. The sidebar's flag list reads the same
range and has no control of its own.

**The DOM wall is gone**, and with it `grid`, `tide`, `erode`, the `dims` tag,
the `?backend=` flag and the flat half of the arrangement interface. `stack` is
the set. The design doc's arrangement table keeps the six as what was tried, so
nobody re-proposes porting one.

**Right-click, and the rescue under it.** A menu on the canvas — Open, Keep /
Release, Dismiss the flag, Copy path, Expire now, and Undo last expiry (also
Cmd-Z). Keeping writes `kept` to the sidecar, so it survives a restart, and
freezes the card's decay where it stood; expiry is undoable one deep and comes
back with a fresh `bornAt`, since its old one is already past its TTL. The
menu is a `reticul8r` parallax window in `window` mode — see the spec for why
not `tilt`, and for the CSS that silently flattens it.

Also landed: an axis gizmo under the minimap, off `params.camera.yawDeg` and
`pitchDeg`; the stack direction set by dragging a card with the wheel button;
`ago` in `src/age.ts`; `cameraBasis` in `src/camera/basis.ts`.

### Decisions made in conversation, in nobody's diff

- **The wall's third dimension comes from the camera, not from a modifier.** A
  drag reaches only the two axes facing the camera; orbiting supplies the
  third. The axis pointing at you is unreachable by dragging, and the gizmo's
  stubby `z` at the origin is what says so. This is why there is no modifier
  key on the step drag.
- **A label stays coplanar with its card, always.** Moving a plate for
  legibility moves it *within* the card's plane — the offset is measured flat
  and turned by the card's rotation. A plate that leaves the plane reads as a
  sticker in front of the wall. This was got wrong once and is easy to get
  wrong again.
- **Scrolling a depressed wheel works on the user's mouse** — confirmed by
  hand, not assumed. If it ever stops working on different hardware, the agreed
  fallback is depth on the drag's vertical axis while the wheel button is held.
  That fallback exists nowhere but here.
- **`@weasel-js/ui` and `@weasel-js/labkit` are published on npm** (1.4.1), so
  reusing weasel components is `npm i`, not a file link. Take `./style.css`
  only. **Never import `@weasel-js/theme`'s tokens.css** — it sets a document
  font and re-types every label in the scene. Its components are painted
  entirely by `--wzl-*` custom properties; with those unset a control renders
  with correct geometry and fully transparent paint, which looks like a
  component that failed to mount. The bridge for the slider is written out in
  `src/topbar.css`, scoped to the band.
- **A stored tuning outranks a changed default, forever.** `mergeStored` lays
  the stored blob over the defaults, so changing a default in `params.ts` does
  not reach anyone who has ever touched that control. Say so when handing over
  a default change, or it reads as the change not working.

### The whole outstanding list

The user's instruction is to work all of it, not just the head.

**Next up, and half-designed already:**

- **The page-wide sort.** One key reorders **both** the zones on the wall and
  the sidebar's flag list — decided, not open. Keys: severity, recency,
  project. It reaches into the layout: zone order comes from the insertion
  order of `byZone` in the stack strategy (`src/arrangements/stack.ts`), fed to
  `zoneGrid`. Severity ordering imposes a ranking the levels deliberately lack;
  the user asked for it anyway, so build it and note it once.
- **More band sections.** Time is the first of several; the band is built to
  take more blocks. Nothing else is specified yet — ask.

**Then:**

- **The `?` modal still places its seven planes by hand.** The library that
  replaces that hand-work exists — `reticul8r` at `~/src/reticul8r`, which the
  context menu already uses — so the modal is now the odd one out rather than
  the reference. Wrapping it is a deletion, not a port.
- **The keep set has no cap.** `DESIGN.md` bounds it at twelve so that keeping
  costs something; the menu ships without the bound on purpose, because nothing
  had ever been kept when it was written. Revisit after living with it, and see
  `docs/superpowers/specs/2026-09-05-context-menu-and-rescue-design.md`.
- **Kept cards do not move to a band of their own.** The decay freeze is all
  that marks one today. The reserved band is arrangement work.

**Independent of all of the above:**

- **The client cannot tell the daemon died.** Receive-only over a socket vite
  proxies, so the browser end stays open when the upstream goes: the wall
  reports itself connected and silently misses every arrival and expiry. Stable
  ids mean this freezes the wall rather than blanking it. A boot id in the
  snapshot that the client re-checks is the shape considered, not decided.
- **The wall costs a core whenever it is open**, and a GPU's worth of memory
  per copy. No `frameloop` prop, so r3f is on `always`. This is not theoretical:
  parking one driven browser on `about:blank` mid-session took free RAM from
  ~250MB to ~1.1GB on a machine deep in swap.
- **Enter should descend a rung**, the inverse of Escape.
- **View state in the URL hash**, so a reload keeps the view. It already
  survives reloads somehow — find out how before adding a second mechanism.
- **`ParamsBody` is a hand-rolled property panel.** `@weasel-js/ui` exports the
  family it reimplements — `PropertyPanel`, `PropertyGroup`, `SliderRow`,
  `NumberRow`, `ColorRow`, `ToggleRow`, `SelectRow` — and the package is now a
  dependency. Replacing it is a real refactor and the user has not called it.
- **`sharp` has a high-severity libvips advisory**, pre-existing and unrelated
  to this work. The fix is a breaking major bump and the daemon uses it for
  thumbnails.
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

- **`LineSegments2.setPositions` leaves a stale instance count.** It keeps the
  count from whichever frame had the most segments, so a frame with fewer draws
  past the end of its own buffer — one `GL_INVALID_OPERATION` per frame, silent
  unless you open the console. Set `geometry.instanceCount = points.length / 6`
  after every `setPositions`.
- **Three separate guesses at "why doesn't my browser show the changes" were
  all wrong.** It was none of: the sidebar starting closed, the DOM backend, a
  dead vite. Stop guessing and have the tab report itself — URL, whether
  `.sidebar`/`canvas` exist, which `slopboard.*` keys are in localStorage. The
  answer is per-profile state and cannot be seen from here.
- **A drag on the front card of a pile divides by rank zero.** Rank 0 does not
  move with the step at all, so the gesture did nothing and read as broken. It
  spreads over one instead, opening the pile out behind the held card.

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
open 'http://localhost:5183/'
```

Every question there is a control in the `params` panel, so a bad answer is a
drag and not a code change. When the numbers settle, write them into
`src/params.ts` — or copy the whole tuned set to the clipboard from the panel,
which pastes straight into that file.

More has arrived unlooked-at than those two tasks ask about: the gesture rail's
two thresholds and its cooldown (`nav`), the hatch backdrop's spacing, width
and angle, and every `sky` knob. All are guesses that have never been judged
against a moving wall.

**The client on 5183 was owned by the session that wrote this handoff and dies
with it.** If the wall's page does not answer, run `npm run dev:client`; the
daemon on 8787 is independent and keeps running. Restart vite after any
`npm install`, and clear `node_modules/.vite` — a dependency added under a
running vite serves 504 "Outdated Optimize Dep" until it is re-optimized.

**Historical, and still true of the daemon:** A memory
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
