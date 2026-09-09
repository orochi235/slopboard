# Where the 3D wall stands

For whoever picks this up next. The plans are the reference and `DESIGN.md`
holds what was decided; this only carries what neither can — session state and
the traps that cost time.

## Done

Plans 1, 2 and 3 are implemented and on `main` in both repos. The two
**eyes-only tuning tasks** at the end of the renderer and interaction plans are
closed unrun: the defaults stand until the wall looks wrong.

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
(`name.ttl5m.ext`, bare number is seconds, wall default now 8h and `sim` tags
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

Landed 2026-09-07, all on `main`: **the wall runs under launchd**. `bin/wall`
writes an agent per half — the daemon on 8787, the client on 5183 — so the wall
comes up at login, comes back after a crash, and no longer dies with the
terminal that started it; the menu bar can Cycle, Start and Stop it. That
daemon runs `tsx` without `watch`, because a file save must not drop what is on
screen, so a server edit takes through `wall cycle`. Also: `reticul8r`'s rename
to `delamin8r` followed through every specifier here (the wall failed to load at
all until it did, and the CSS prefix moved `rz-` to `dl-`); the client binds
`::` so both loopbacks answer; and the lightbox centers with `place-content`.

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

All on `main`. `git log --oneline fb029be..HEAD` is the list, and each message
carries the reasoning that is not in the diff.

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

**An arrival can ask for the screen.** `ALERTS` in `shared/attention.ts` is a
row per attention level — `lightbox`, `sound`, `notify`, `raise` — and the
daemon owns three of the four, because a page cannot make noise it has not been
clicked for, cannot notify without a permission, and can never raise its own
window. `problem` starts the wall if nothing is connected; `clients.size` is
how the daemon knows. Untested against a real flagged arrival: the plan is
unit-tested, the three `spawn` calls are not.

**The wall's defaults are now the tuned wall** (`2470b0f`). Remember that a
stored tuning outranks a changed default forever, so this reaches a new wall
and nobody who has already touched a control — including this machine.

**The DOM wall is gone**, and with it `grid`, `tide`, `erode`, the `dims` tag,
the `?backend=` flag and the flat half of the arrangement interface. `stack` is
the set. The design doc's arrangement table keeps the six as what was tried, so
nobody re-proposes porting one.

**Right-click, and the rescue under it.** A menu on the canvas — Open, Pin /
Unpin, Dismiss the flag, Copy path, Expire now, and Undo last expiry (also
Cmd-Z). Pinning writes `kept` to the sidecar, so it survives a restart, and
freezes the card's decay where it stood; expiry is undoable one deep and comes
back with a fresh `bornAt`, since its old one is already past its TTL. The
menu is a `delamin8r` parallax window in `window` mode — see the spec for why
not `tilt`, and for the CSS that silently flattens it.

Also landed: an axis gizmo under the minimap, off `params.camera.yawDeg` and
`pitchDeg`; the stack direction set by dragging a card with the wheel button;
`ago` in `src/age.ts`; `cameraBasis` in `src/camera/basis.ts`.

### The sort, the modal and the pages — shipped

All on `main`, 2026-09-06.

**The `?` modal is delaminated** (`c01b811`). It declares a `data-dl-lift` per
layer and nothing else; the rows listing the layers read their Z back off
`handle.planes`, so the card cannot describe a stack it is no longer in.

**The page-wide sort is built** (`3fe3d64`). Three keys in the band, and the
sidebar's flag list reads the same one. The design note that sent it there was
wrong: zone order is *not* the insertion order of `byZone` — `createZoneGrid`
sorts the names it is handed and holds a slot per zone, so it discarded the
caller's order entirely. It takes that as a mode now, `project` keeping the
held cells and the other two keys filling cells in the sort's order. See
`DESIGN.md` under **Ordering the zones**.

The rest of that day (`8c245a2..94c587d`):

- **A zone can be taken from its backdrop.** Right-click a zone's backdrop or
  label for "Expire the zone (n)"; it arms on the first click and reads "Really
  — expire n" before the second. Not a `confirm()` — a browser modal blocks the
  page's event loop. `undoExpiry` now holds the batch an expiry took rather than
  one artifact, so a zone goes and comes back in one Cmd-Z; a single card is a
  batch of one, so nothing about the old behaviour moved.
- **The wall is framed clear of the filter band.** `framePose` gained
  `insetTop` beside the `insetRight` the sidebar already used — the band is an
  overlay on the canvas, so the top row of zones used to sit behind it at every
  zoom.

- **A refresh no longer replays the last day.** The decode-order theory in the
  old entry was wrong and is recorded as wrong in `8c245a2` — all the image
  requests go out inside 20ms and land in chance order against the snapshot,
  so there was no queue to reorder. The fault was that the card quad's
  `<meshBasicMaterial>` took three's default white, so ~130 white rectangles
  turned into pictures over ~400ms. An untextured card now takes
  `colors.cardBlank`, and the wall holds dark until the front of every pile has
  decoded (`lod.revealHoldMs`, `lod.revealFadeMs`), then fades in assembled.
- **Alert debug buttons** are in the sidebar's debug section, one per level.
  They are not a client-side fake: `POST /api/debug/alert/:level` runs the same
  `alert` an arrival runs. The `raise` arm that launches a browser is
  unreachable from the button — it lives in the wall, so `clients.size` is
  never zero at that route.

- **The wall holds HTML pages, not only images.** Built from
  [`2026-09-06-html-artifacts.md`](2026-09-06-html-artifacts.md), which is
  ticked through. Headless Chrome shoots a page once at ingest and the shot
  goes through the picture pipeline, so nothing in the renderer branches on the
  kind; `/orig` serves the source, so the lightbox runs the page live in an
  iframe. `--sandbox` rides the sidecar and is the pusher's declaration.
  `DESIGN.md`'s ingest contract is the reference.

### The wheel throttle and the arrow axis — shipped

Built from [`2026-09-08-wheel-throttle.md`](2026-09-08-wheel-throttle.md),
ticked through; `git log --oneline 6e87fda..12c7a2a` is the list. Everything
here and above is pushed — `origin/main` is at `12c7a2a`. One physical gesture
now buys one rung: the design is in `DESIGN.md` under **One rung per gesture**,
and `nav.cooldownMs` is gone, replaced by the quiet gate under `src/nav/`
(`mergeStored` drops the old key on load). Defaults are `quietMs: 90`,
`floorMs: 320`, measured across flicks, decaying tails and deliberate rolls.

Worth knowing before touching it again:

- **`nav.quietMs` is floored at 40 in the slider**, not 0. At 0 every event
  reads as a fresh gesture and zeroes the charge before a trackpad stream can
  reach the threshold, so the wall was unnavigable at the low end of its own
  control.
- **An arrow now has to lie within 45 degrees of the axis it was sent along.** A
  zone's cell is the union of its pile's drawn cards, so a five-card pile is a
  different size from a three-card one and the rows miss each other by about a
  hundredth of the wall. Any drift at all counted as being in a direction, so
  from the bottom-left zone, left went to the zone *above* it — and left, then
  back right, skipped the zone you started on.

### The corner chips — shipped

All on `main`, 2026-09-08, `42b12d0..ec6cbc5`. Two readouts the wall could not
give without opening something: how old a pile's front card is, and how much a
zone holds.

**The age chip** rides inside each pile's front card, top-left — a clock and
`ago()`'s one-unit age, black plate, yellow clock, white text. Only the front
card wears one; a rank behind it is mostly hidden anyway.

**The count chip** is centered on the zone's bottom-right corner, filled with
the outline's own color by the outline's own rule, so the two cannot disagree
about whose zone it is.

**The zone's frame draws in one stack below the cards** — hatch (`-3`), border
(`-2`), count (`-1`), then every artifact at `0`. A pile covers all of it,
because the frame is the wall the pile hangs on. The border used to draw at
`CHROME_ORDER` and cut straight through the count beside it.

**`zones.huedOutline` and `huedLabel` merged into `huedFrame`.** Three parts of
one frame with separate switches is three ways for them to disagree.

**The ink is chosen by contrast ratio**, not a lightness threshold: green
carries most of the luminance sum, so any threshold keeping white legible on a
mid blue also keeps it on a mid green, at 2.5:1. `inkFor` in
`src/textures/chip.ts` is the only tested part of that file.

**Scrolling out at fit leaves the lightbox**, the inverse of the flick that
opened it, and only on a fresh gesture — a roll that zooms out as far as fit
stops there. The **page** lightbox is untouched: a wheel inside an iframe never
reaches us, so the rule would only hold over the margin around the frame.

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
- **The wall does not wear weasel's themes** (2026-09-07). Neither the DOM
  chrome nor the scene follows them; slopboard keeps its cyan, and
  `params.colors` stays the only thing that sets the wall's palette.
  `spike/weasel-theme` is deleted — `8062c3a` in the reflog is the spike, and
  the only place `@weasel-js/theme` was ever installed. Weasel's *components* stay — the filter band's `RangeSlider` is
  `@weasel-js/ui`, painted through the `--wzl-*` bridge in `src/topbar.css`.
- **A stored tuning outranks a changed default, forever.** `mergeStored` lays
  the stored blob over the defaults, so changing a default in `params.ts` does
  not reach anyone who has ever touched that control. Say so when handing over
  a default change, or it reads as the change not working.

### The whole outstanding list

The user's instruction is to work all of it, not just the head.

**Another session is writing in `server/`.** Four untracked files appeared
mid-session on 2026-09-08 — `watchTree.ts`, `watchTree.test.ts`,
`inboxSweep.ts`, `inboxSweep.test.ts`, the chokidar reconcile sweep from the
list below. `watchTree.test.ts` does not typecheck yet, so `tsc --noEmit` and
`npm test` both report a failure that is theirs, not yours. Keep `git add`
scoped to your own paths and do not "fix" those files.

**In flight — the weasel control swap.** Plan at
`docs/superpowers/plans/2026-09-08-weasel-controls.md`, spec beside it. Tasks
1-4 are done and on `main` (`20cc948` and back); **tasks 5, 6 and 7 are not
started**. Task 5 is the filter band: `RangeSlider` to `Slider`, histogram into
`renderTrack`. The plan's step-by-step for it is current except that its stated
cause for the band's narrow track was corrected in `72b26f3` — the 82px track
is our own `align-items: center` on a column flex container, not a weasel bug.

The bridge now lives in `src/weasel.css` as `.wzl-skin`, worn per params group
and by `.topbar__range`. Four tokens it was missing are why the rows first
rendered invisible; two of them are **percentages inside a `color-mix`, not
colors**, and two carry **no fallback**, so unset means no height rather than a
default. All four are written up with the rest of the weasel friction in
`~/src/weasel/todo.md` (uncommitted — that repo has unrelated work in its tree).

**Also asked for 2026-09-08, not started:**

- **A "pinned" badge, top right, just the emoji in a badge.** Pinning is
  `keptAt`; `src/textures/badge.ts` draws the attention plates and
  `src/textures/chip.ts` the corner chips, so the question is which of the two
  a pin badge is.
- **Hued zone background colours need a minimum lightness** — weasel's is the
  one that prompted it. `params.colors` and the daemon's per-zone colour in
  `server/zoneColors.ts` are the two ends.
- **The inbox watcher needs a reconcile sweep.** chokidar 4 calls `fs.watch`
  per directory with no `recursive` and no fsevents, and
  [#1471](https://github.com/paulmillr/chokidar/issues/1471) — open, still in
  v5 — silently drops a file written into a directory between its scan and its
  watch registration. `bin/slop` does `mkdir -p` then `cp`, so a brand-new
  zone's first artifact lands in that window. A periodic scan that ingests
  what the store lacks makes the watcher an optimization; v5 is packaging only
  and fixes none of it. Proposed 2026-09-08, not approved, not built.
- **More band sections.** Time and sort are the first two; the band is built to
  take more blocks. Nothing else is specified yet.

**Then:**

- **The pin set has no cap.** `DESIGN.md` bounds it at twelve so that keeping
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
- **`sharp` has a high-severity libvips advisory**, pre-existing and unrelated
  to this work. The fix is a breaking major bump and the daemon uses it for
  thumbnails.
- **"also tomorrow"** — an unresolved fragment of a message. Ask before acting.

### Known-unjudged, deliberately

Nobody has looked at these and nobody needs to. They are here so a later
surprise is recognized rather than debugged.

- **Pulse is off** — `attention.pulse` is a master gain at 0. Rate climbs with
  level underneath it; nobody has watched it move.
- **`urgent` is `#ff8000`**, the one plate that is not pure-channel, because
  orange cannot be. Magenta would complete the set and separate urgent from
  problem, which are adjacent hot hues today. Noticed, not proposed.
- **Zone label headroom is vertical only**, so a long name may crop once the
  label sits outside the cell. Not checked against a long one.
- **Typeface defaults to Oxanium** for both uses, unjudged.

### Traps this cost real time

- **A stored blob makes a changed default invisible, and it will fool you
  twice.** Two rounds of "the chips are off-center" and "the frame is not
  hued" were a browser profile pinning the old values, not the code. Have the
  tab report `localStorage['slopboard.params.v2']` before touching placement
  or color. **A parameter whose *meaning* changed has to be renamed**, not
  redefined: `mergeStored` drops a key the defaults no longer have, which is
  the only way a stored number gets given back. `chips.pad` became
  `chips.inset` and `chips.bleed` for exactly this reason, as `cooldownMs`
  became `quietMs` before it.
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
- **The wall's daemon does not watch.** Under launchd it runs `tsx` without
  `watch`, so a server edit reaches the wall only through `wall cycle`. A
  daemon you start yourself with `npm run dev` does watch — editing anything
  under `shared/` or `server/` restarts it, and the worker pid
  (`pgrep -f preflight.cjs`) is how you confirm that, not the supervisor's,
  which never changes.
- **The devtools browser is a different profile from the user's.** Its
  `localStorage` params are not theirs; state read there says nothing about what
  they see. Chasing that wasted a round of colour "bugs" that were never real.
- **Every open copy of the wall costs a core**, so leaving a driven browser on
  the page is not free.

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

### Make the page a lab — decided, unbuilt

`?lab` splits the page: the wall a room looks at, and the lab a person tunes it
from. The list of which surface goes where, and why a flag rather than a second
build, is in `DESIGN.md` under **The lab and the wall** — decided 2026-09-08,
and **nothing is built**.

The handoff used to call this "the params panel, the minimap and the HUD", and
that list did not survive being checked against the code. The sidebar, the
filter band, the minimap, the right-click menu and the lightbox are all
user-facing; what leaves a wall is the sidebar's *debug* and *params* sections,
the `,` modal, the axes gizmo and the HUD's arrangement name.

The stats block below wants building on the far side of this, since it is lab
chrome that would otherwise be built twice.

### Also parked

`spike/cell-relative-side` renders `side` as a fraction of the zone's cell
rather than a world constant (`?side=cell`), scaling the pile's step and jitter
to match. Both readings were rendered to the wall as `side: world constant vs
fraction of the cell, at 6 columns`, at six columns because that is where they
diverge. Adopting it means re-tuning `side` once and re-reading what the `lod`
tiers mean, since rank-to-edge was calibrated against a card of stable size. It
leaves `step.z` absolute, so a deep pile still trails past its cell either way.

## Running it

**The tuning is not a gate.** The renderer plan's Task 10 and the interaction
plan's Task 7 are closed: the defaults stand, and a number gets changed when
something on the wall looks wrong, not before. Same for `nav`, the hatch and
`sky` — never judged, and that is fine. Do not hand any of it back as a
question.

```bash
cd ~/src/slopboard && bin/wall stat   # it is already up under launchd
npm run sim -- --rate=2400 --zones=alpha,beta,gamma,delta,epsilon,zeta
open 'http://localhost:5183/'
```

Every number is a control in the `params` panel, so a bad one is a drag and not
a code change. If a set settles, copy it to the clipboard from the panel and
paste it into `src/params.ts`.

**Both halves belong to launchd now, not to a session.** `wall stat` says what
launchd thinks and whether the daemon answers; `wall cycle` restarts both. To
drive the page from a session instead — for a vite that reloads on edit —
`npm run dev:client` serves it against the running daemon. Restart vite after
any `npm install`, and clear `node_modules/.vite`: a dependency added under a
running vite serves 504 "Outdated Optimize Dep" until it is re-optimized.

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
- **`pkill -f 'tsx watch server'` no longer finds the real wall's daemon**, and
  a signal does not stop it either: launchd's `KeepAlive` has it back within
  seconds. `wall down` and `wall cycle` are the way. A taken 8787 is handled —
  a `npm run dev` daemon attaches to the live one and exits 0, so you get a
  client against the running wall.
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
