# Where the 3D wall stands

For whoever picks this up next. The plans are the reference; this only carries
what they cannot: session state and the traps that cost time.

## Done

Plans 1, 2 and 3 are implemented and on `main` in both repos, except the two
**eyes-only tuning tasks** — the last task of each plan. Those are deliberately
still unticked, because their deliverable is a judgment.

- windease `main`: `Rect.z` (required), `LayoutResult.channels`, both wired
  through `ContainerHost` and the presets. 1472 tests.
- slopboard `main`: the WebGL wall behind `?backend=webgl`, texture LOD with a
  byte budget, camera zoom, arrow navigation, the lightbox, and a live parameter
  panel. 96 tests.

## Do this first

Run the wall and answer the questions in
[the renderer plan's Task 10](2026-09-02-webgl-renderer.md) and
[the interaction plan's Task 7](2026-09-02-webgl-interaction.md):

```bash
cd ~/src/slopboard && npm run dev
npm run sim -- --rate=2400 --zones=alpha,beta,gamma,delta,epsilon,zeta
open 'http://localhost:5173/?backend=webgl'
```

Every question there is answered by a number in the params panel, so a bad
answer is a value change and not a code change. When the numbers settle, write
them into `src/params.ts` and record what the DOM wall could not tell you in
`DESIGN.md` — the receding-wall concept is still formally a *candidate* there.

## Traps already paid for

- **`Texture.flipY` does nothing for an `ImageBitmap` source.** three only
  applies it to an `HTMLImageElement`, so the flip happens at
  `createImageBitmap` instead. Every card renders upside down without it, and
  the obvious fix is the one that does not work.
- **Framing the container crops the wall.** A pile's cards are centre-anchored
  on its cell and overhang it, so the camera frames the union of what is drawn
  (`zoneCellsOf` / `unionOf`), not `{ w: aspect, h: 1 }`.
- **The camera must retarget from the frame loop.** Zone cells are unknown until
  the first layout has run, so framing only on a view change parks the camera at
  a fallback pose forever.
- **`npm run dev` will not start the daemon if one is already on 8787**, and
  `pkill -f 'tsx watch server'` kills the real wall's daemon, not just yours.

## Not done

Plan 2's risk list still stands: one mesh per item rather than instanced or
atlased, and zoom does not promote an LOD tier — the ratchet refuses to grow a
texture, so a zoomed pile shows deep cards at the edge their rank earned.
Both are follow-ups with a profile or a complaint as the trigger, not oversights.
