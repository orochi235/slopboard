# Where the 3D wall stands

For whoever picks this up next. The plans are the reference and `DESIGN.md`
holds what was decided; this only carries what neither can — session state and
the traps that cost time.

## Done

Plans 1, 2 and 3 are implemented and on `main` in both repos, except the two
**eyes-only tuning tasks** — the last task of each plan. Those are deliberately
still unticked, because their deliverable is a judgment.

- windease `main`: `Rect.z` (required), `LayoutResult.channels`, both wired
  through `ContainerHost` and the presets. 1472 tests.
- slopboard `main`: the WebGL wall behind `?backend=webgl`, texture LOD with a
  byte budget, camera zoom, arrow navigation, the lightbox, and — since the
  plans were written — an orthographic default, corner-anchored piles, an
  orbiting camera you drag, a slider panel over every parameter, a clickable
  plan view, and in-scene zone outlines and labels. 145 tests.

Since then, on `main`: a per-item TTL written into the filename
(`name.ttl5m.ext`, bare number is seconds, wall default now 24h and `sim` tags
its own cards `ttl60`); a port guard on both halves (a taken 8787 attaches to a
live daemon or names `SLOP_PORT` and exits 1, instead of an unhandled error
event; the client has its own port 5183 with `strictPort`); card outlines,
panel grouping, and params persisted to localStorage.

Read `DESIGN.md` under **The stack's camera** before touching the camera or the
arrangement. It carries the one thing that is not visible in the code: a pile
is a volume — deeper than the whole wall is tall at 29 cards — and every box
computed about it is flat, because windease's `Rect` has a z position and no z
extent. That is why framing goes loose once you turn the camera off head-on.

## Asked for and not built

Four requests arrived while the last commit was in flight. None is started.

- **Wheel-zoom the hierarchy.** Scrolling out from a focused pile should return
  to the wall, with a threshold so a stray trackpad nudge does not fire it. The
  ask is explicitly general: wall → zone → card is the hierarchy that exists
  today, and the navigation should hold for however many levels it grows.
  `src/view-state.ts` already models the levels as a reducer, so the work is a
  wheel gesture dispatching into it plus a camera level per rung — not a new
  model. Worth reading that reducer before designing, and worth asking whether
  zoom-in should select a pile under the cursor or the focused one.
- **A cosmetic background layer.** A skybox behind the wall, nebula-ish. Purely
  decorative, so the constraint is that it must not compete with the cards:
  they are the content and most of them are dark. A procedural shader on a
  large inverted sphere or a full-screen quad behind the scene costs no texture
  budget and needs no asset, which suits a wall that already accounts every
  byte it uploads. Its knobs belong in `params.overlay`'s neighbourhood so the
  panel can tune it, and it should be switchable off.
- **Wear weasel's themes, as far as they reach.** `@weasel-js/theme` is
  published (1.3.0), so this is an ordinary npm dependency, not a linked
  checkout like windease. It is DTCG tokens with a mode layer (`weaselTheme`
  defaults to dark) applied as CSS custom properties.

  The qualifier is the work. Two halves reach differently: the DOM chrome —
  params panel, HUD, lightbox, minimap — takes `tokens.css` and `applyTheme`
  directly, and slopboard's hand-picked hex values in `params.css` become token
  references. The scene does not: three wants a `THREE.Color`, not a CSS
  variable, so the card outline, the zone outline's idle and focus colors, the
  label fill and the flat-quad tier need a token→Color bridge read once at
  startup and on a mode change, not per frame. Decide whether the scene follows
  the theme at all before building that bridge — a wall of images may want a
  neutral surround more than a branded one.

- **Make the page a lab.** The params panel, the minimap and the HUD are
  developer chrome that a real wall display should not carry. The ask is to
  name that: this page is the lab, and a non-lab wall comes later. No decision
  yet on the mechanism — a `?lab` flag beside `?backend`, a separate route, or
  a build-time split — and that decision is the first thing to settle.

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
`src/params.ts`.

To run against a daemon other than the one serving the real wall, set
`SLOP_ROOT` and `SLOP_PORT` on both the daemon and the client — `vite.config.ts`
points its proxy at `SLOP_PORT`. Without that the sim writes into `~/slop/inbox`
and its cards show up on the real wall for a TTL.

## Traps already paid for

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
