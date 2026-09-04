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

Read `DESIGN.md` under **The stack's camera** before touching the camera or the
arrangement. It carries the one thing that is not visible in the code: a pile
is a volume — deeper than the whole wall is tall at 29 cards — and every box
computed about it is flat, because windease's `Rect` has a z position and no z
extent. That is why framing goes loose once you turn the camera off head-on.

## Asked for and not built

Two of the four asks landed. These are what is left, and the first one is a
question rather than a task.

- **Wear weasel's themes — the decision is yours, and it is bigger than it
  looked.** The question in the words it needs answering in: **should the
  wall's own furniture go violet?** Weasel's accent is a midnight violet where
  slopboard's is cyan, so a scene that follows the theme repaints every card
  outline, every zone label and the sky. A wall that follows it in the DOM
  chrome only changes almost nothing you can see — the panel's hand-picked
  darks already sit within a hair of weasel's. So "does the scene follow the
  theme" is not a side question about a bridge. It is the whole question.

  Both options are on the wall as `theme-options` for 48 hours, A above B.
  The branch `spike/weasel-theme` rendered them and is throwaway:
  `?theme=weasel` is A, `?theme=weasel-scene` is B.

  What the spike settled, so nobody re-derives it: `resolveTheme(theme, mode)`
  is pure, DOM-free, and hands back a concrete `#hex` per token — the scene
  needs no `getComputedStyle` and no CSS parse, and a token goes straight into
  a `THREE.Color`. `@weasel-js/theme/react` publishes the same record as
  `useTheme().resolved`, for precisely this case. The bridge is not the work.

  Two things the ask did not know. `tokens.css` also sets `:root { font-family:
  Oswald; font-weight: 300 }`, so importing it re-types the whole wall and not
  only its colours. And a second fork waits behind the first: whether a theme
  **replaces** `params.colors` or only **seeds** it. `mergeStored` lays a stored
  tuning over the defaults, so a theme that merely seeds them is outranked
  forever by any entry the panel has ever touched, and a mode flip never
  reaches it.

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
`src/params.ts` — or copy the whole tuned set to the clipboard from the panel,
which pastes straight into that file.

More has arrived unlooked-at than those two tasks ask about: the gesture rail's
two thresholds and its cooldown (`nav`), the hatch backdrop's spacing, width
and angle, and every `sky` knob. All are guesses that have never been judged
against a moving wall.

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
