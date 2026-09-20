# Going public

slopboard becomes a public GitHub repo, a Pages site at `michaelbaker.tech/slopboard/`
with a running demo, and a tile on the portfolio. This is the design for that work;
the reader is whoever implements it and already knows what slopboard does.

Steps 1 and 2 are done. The rest — demo mode, the image set, Pages and the
portfolio tile — is unbuilt, and all of it is local.

## What blocked a stranger

`vite.config.ts` aliased `windease` and `delamin8r` to `../windease/src` and
`../delamin8r/src`, and `package.json` named both as `file:` dependencies. A clone
with no sibling checkouts failed at install and again at resolve.

Nothing else blocks: one author at `contact@michaelbaker.tech`, no home paths in
tracked files, 2 MB of history. No rewrite.

## 1. Unlink the siblings — done

The two aliases are conditional on the sibling directory existing. Present, they
win and local dev is unchanged — windease is co-designed with this repo and its `main`
points at a `dist` an edit does not reach, which is why the aliases exist at all.
Absent, resolution falls through to `node_modules`.

`package.json` takes `"windease": "^2.0.0"` and `"delamin8r": "^0.2.1"`, and the
lockfile records registry tarballs. Verified against a copy of the tree with no
siblings beside it: `npm ci`, `tsc --noEmit` and `vite build` all clean.

## 2. Cut windease 2.0.0 — done

Required `Rect.z` and the removal of `windease/react`'s shadowing `Rect` are both
breaking, so this was 2.0.0. Published; the tarball carries both fields.

## 3. Demo mode

`useWall` is the only transport seam: it opens one WebSocket and reduces the
`ServerMessage` union into state. Demo mode is a second producer of that same stream,
so nothing downstream of the hook changes.

**`src/demo/daemon.ts`** — a scripted arrival timer plus the lifetime bookkeeping the
real daemon owns. It emits `snapshot` on subscribe, then `arrive`, `expire` and `beat`
against a manifest. Items carry real `bornAt` offsets so a viewer arrives at a wall
with depth already in the piles rather than an empty one that fills.

**`src/actions.ts`** — the nine scattered `fetch('/api/…')` calls in `WebglBackend.tsx`
and `Sidebar.tsx` move behind one module: `keep`, `expire`, `dismiss`, `undo`,
`expireZone`, `pinZone`. Demo mode points them at the fake daemon's reducer. This is
the only change to existing client code, and it is worth making regardless — the call
sites currently each carry their own `.catch(() => {})`.

**The flag is build-time**, `import.meta.env.VITE_SLOP_DEMO`. The Pages bundle must not
ship a WebSocket that retries forever against a daemon that isn't there. Local demo
work runs `VITE_SLOP_DEMO=1 npm run dev:client`.

Three behaviors differ in demo mode, because a browser has no filesystem behind it:

- **Open** leaves the right-click menu. A local path means nothing to a stranger.
- **Copy path** copies the demo image's URL instead.
- `kind: 'page'` artifacts are out of scope. The manifest carries pictures only.

## 4. The demo image set

**`tools/demo-set.mjs`** walks `~/slop/inbox/` and stages candidates for pruning by
hand. What survives is committed under `demo/img/` with a manifest of zone, name,
dimensions and `bornAt` offset.

It takes an **allowlist** of zones, never a denylist. The real wall carries work zones,
and a new one must fail closed — a denylist ships a Point Wild render to a public site
the first time a repo nobody updated the list for produces something.

Images go out at the wall's own 1024px longest edge as WebP. Fifty of them is roughly
6 MB, which is the repo's whole weight gain.

## 5. Pages

`.github/workflows/site.yml` on perch's shape — `push` to `main` plus
`workflow_dispatch`, `concurrency: pages` with `cancel-in-progress`,
`upload-pages-artifact` then `deploy-pages` — but `ubuntu-latest`, since nothing here
needs a Mac.

The build assembles `_site/`:

- `/` — a hand-written static landing page from `site/`. What it is, the one-line agent
  integration, a link to the wall and to the repo. No framework; it is one page.
- `/wall/` — the existing client, `base: '/slopboard/wall/'`, `VITE_SLOP_DEMO=1`.

A stranger who lands on the wall alone sees a pretty screensaver. The landing page
exists to say the images arrive from agents and die on a timer.

## 6. Portfolio tile

Configuration only. `ProjectMedia` already supports `kind: 'embed'` with `eager: false`,
which holds at a still showing **▶ RUN DEMO** until the tile is engaged — which is the
wanted behavior exactly, and the reason the index page does not take a third WebGL
context on load beside klieg's masthead and the magicsmoke tile.

`src/projects/slopboard.ts` in the portfolio repo, plus its line in `index.ts`:

- `demo` and `media.src`: `https://michaelbaker.tech/slopboard/wall/`
- `captureFrom`: the same URL. `scripts/capture-media.ts` drives Chrome and shoots the
  still itself, so there is no image to hand-make.
- `related`: windease, delamin8r, perch, hued — all four are load-bearing here.

## Also in scope

- `LICENSE` — MIT, `Copyright (c) 2026 orochi235`, matching perch, klieg, magicsmoke,
  pezlie and hued.
- `README.md` — the repo has none.
- Delete `wall-borders.png` (308 KB, unreferenced; one test uses the filename as a
  string) and `docs/superpowers/plans/HANDOFF.md` (live session state).
- Seventy British spellings across tracked files, nearly all of them *color* in comments.

`DESIGN.md`, the ten remaining specs and plans, `bin/`, `menubar.yaml` and
`skills/slopboard/` all stay. A tool for agent workflows that hides how it was built
with one is strictly less interesting.

## Out of scope

Page artifacts in the demo. A docs site beyond the one landing page. Any install story
better than "clone it and run two npm scripts" — that is worth doing, and it is not
what going public requires.
