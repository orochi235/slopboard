# Handoff — what the band and the zones do now, and what is still owed

For whoever picks up slopboard next. Branch is `main`. What landed is in the
log: `git log --oneline`.

## What just happened

**Zones can be pinned.** A zone pinned from its right-click menu leads whatever
the sort key says, its label carries a mark, and the daemon keeps the set in
`pins.json` beside the inbox. A pin costs `project` its held cells while one is
held — `createZoneGrid` would otherwise hand every zone the slot it already had
and the pin would reach nothing. See *Ordering the zones* in DESIGN.md.

**A zone's label picks as the zone**, ahead of the cards: it draws with no depth
test and is always on top, so it takes the pick where it overlaps one. Before
this, the label was the only part of a zone that answered as empty sky.

**The arrows drive a cursor from the wall.** First press lights the first cell,
the rest walk it, Escape puts it away, Enter goes in. It is not the view — the
camera stays out until asked — which is why it is a second prop on
`ZoneOverlay` rather than reusing `focus`, whose other job is to shrink the
count chips when the camera closes in.

**The band's panels are components now**, in `src/panel/` — `Panel`,
`PanelRow`, `Keys`, and `panel.css`. They take nothing from the band but the
palette and the type they inherit, so they are one move from `@weasel-js/ui`.
`topbar.css` keeps only what is the band's own. The sorts are rows keyed F1–F3,
the arrangement carries `[` and `]`, and the plan's cells wear their zones'
colors and hatch.

## Next: stacks as one long list

The user's words: "there should be an option to put stacks into one big list so
you can page left and right between stacks when you get to a list boundary. this
would have to move the background, too." And, separately: "I should be able to
shift-arrow while zoomed into a stack to switch stacks" — the same mechanism, so
design them together.

So: paging left/right inside a pile continues into the neighboring pile rather
than clamping, and the camera carries the backdrop with it. Today the arrows
clamp at a pile's ends — see the `direction !== 'left' && 'right'` branch in
`WebglBackend`'s keydown — and each zone has its own backdrop in `ZoneOverlay`.
An option, per the user, not a replacement.

Related and already written down: DESIGN.md's "Inbox — not built" note, the
second arrangement (all artifacts, zones ignored, newest first). The registry in
`src/arrangements/index.ts` holds exactly one arrangement today, so `[` and `]`
cycle a list of one and have always been no-ops — which the band now advertises
with two keycaps.

## Next: a prefs window

Asked for, not designed. `Prefs.tsx` exists and is a dialog on `,` that shares
`ParamsBody` with the corner panel; its own docstring says the tab strip is
where the surfaces that are not parameters go, such as which repos report to the
wall. None of that is built. Ask what it should hold before building it.

## Traps

**The user's own wall daemon is stale.** It is a plain `tsx server/index.ts`
started days ago, not `tsx watch`, so it has none of the server-side changes —
`pins.json` and the `frames` field among them. It needs a restart to show any of
this, and restarting it is the user's call.

**Stored params beat new defaults.** `loadParams` merges a saved blob over the
defaults key by key, so changing a default in `src/params.ts` does nothing in a
browser that has tuned that key.

**To see a change without touching the user's wall**, run a throwaway pair:

```
SLOP_ROOT=/tmp/probe SLOP_PORT=8788 node_modules/.bin/tsx server/index.ts
SLOP_PORT=8788 SLOP_CLIENT_PORT=5187 node_modules/.bin/vite
```

Drop images into `/tmp/probe/inbox/<zone>/` first. For zone colors, write
`/tmp/probe/zones/<zone>.json` holding `{"root": "<dir with a .hued>"}`. Port
5184 belongs to another project on this machine; vite fails loudly on it,
having `strictPort`.

**A zone is hard to right-click.** A pile's card meshes — buried ranks
included — cover nearly its whole cell, so the pick only reaches the zone in a
thin margin. The label is the reliable target. This governs `Expire the zone`
too.

**`server/watchInbox.test.ts` is flaky.** It fails on `ENOTEMPTY` removing its
temp `.cache` when the box is busy — an fs teardown race against its own ingest
pipeline, not a regression in whatever you just changed.

**A presentation attribute loses to any stylesheet rule.** `fill` on an SVG
shape is one, which is why the plan's hatch rides in the `style` object rather
than the `fill` attribute.

**The params rows are `PropertyRow` + a bare `Slider`, not `SliderRow`.**
`SliderRow` puts its readout beside the label and its internals are hashed
CSS-module classes, so there is no way to reorder them from here. The kit's own
`Slider` takes `readoutPlacement="inline-after"`, which is the supported path.

**`clear` is gone from the TIME block** at the user's request. A lit bucket still
toggles itself off, but after dragging the range thumbs to something custom the
only way back to the full span is dragging them out again.
