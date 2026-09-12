# Handoff — the band, and two features after it

For whoever picks up slopboard next. Branch is `main`, working tree clean at the
time of writing. What landed is in the log: `git log --oneline @{u}..HEAD`.

## What just happened

The wall's chrome moved into the top band. The plan view and the axis gizmo were
floating panels over the wall, and the arrangement name was a corner HUD; all of
it is now blocks in the band — `TIME · SORT · … · VIEW · MAP · AXES`, the last
three held against the right edge. Every block is a `<fieldset>` whose `<legend>`
notches its border. Alongside that: the lightbox meta line names the artifact's
kind, the params panel reads units beside values instead of inside names, and
the wheel paces at one rung per 800ms.

Nothing is half-finished. The two items below have not been started.

## Next: pin a zone

Pinned zones rise to the top of the wall. Asked for, not designed — every
question below is open and the user has answered none of them:

- Where the pin lives. There is already a right-click menu with zone actions
  (`src/menu/items.ts`, and `menuTarget?.kind === 'zone'` in `WebglBackend`),
  which is the obvious home.
- Where the pin is kept. Items are pinned daemon-side, in a sidecar, and the
  wall reads `keptAt` off the `WallItem` — but a zone is not an artifact and has
  no record of its own. Client storage (`params.store.ts` is the local
  precedent) or a new daemon-side file are both live options.
- What "rise to the top" means against the grid. Zone order is
  `zoneOrder(items, sort, now)` in `src/nav/sort.ts`, and the grid cells come
  from `zoneCellsOf` over windease's `gridStrategy` — pinning is most likely a
  sort key that floats pinned zones first, not a new layout.

## Next: stacks as one long list

The user's words: "there should be an option to put stacks into one big list so
you can page left and right between stacks when you get to a list boundary. this
would have to move the background, too."

So: paging left/right inside a pile continues into the neighbouring pile rather
than clamping, and the camera carries the backdrop with it. Today the arrows
clamp at a pile's ends — see the `direction !== 'left' && 'right'` branch in
`WebglBackend`'s keydown — and each zone has its own backdrop in `ZoneOverlay`.
An option, per the user, not a replacement.

Related and already written down: DESIGN.md's "Inbox — not built" note, the
second arrangement (all artifacts, zones ignored, newest first). The registry in
`src/arrangements/index.ts` holds exactly one arrangement today, so `[` and `]`
cycle a list of one and have always been no-ops.

## Traps

**The user's own wall daemon is stale.** It is a plain `tsx server/index.ts`
started days ago, not `tsx watch`, so it has none of the server-side changes —
the `frames` field that drives the ▶ chip on animated cards among them. It needs
a restart to show any of this, and restarting it is the user's call.

**Stored params beat new defaults.** `loadParams` merges a saved blob over the
defaults key by key, so changing a default in `src/params.ts` does nothing in a
browser that has tuned that key. `nav.floorMs` went to 800 in the code and is
still 320 in the user's browser until he moves the slider.

**To see a change without touching the user's wall**, run a throwaway pair:

```
SLOP_ROOT=/tmp/probe SLOP_PORT=8788 node_modules/.bin/tsx server/index.ts
SLOP_PORT=8788 SLOP_CLIENT_PORT=5187 node_modules/.bin/vite
```

Drop a few images into `/tmp/probe/inbox/<zone>/` first. Port 5184 belongs to
another project on this machine; vite fails loudly on it, having `strictPort`.

**The params rows are `PropertyRow` + a bare `Slider`, not `SliderRow`.**
`SliderRow` puts its readout beside the label and its internals are hashed
CSS-module classes, so there is no way to reorder them from here. The kit's own
`Slider` takes `readoutPlacement="inline-after"`, which is the supported path.

**`clear` is gone from the TIME block** at the user's request. A lit bucket still
toggles itself off, but after dragging the range thumbs to something custom the
only way back to the full span is dragging them out again.
