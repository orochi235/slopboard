# The right-click menu, and the rescue behind it

For whoever picks up slopboard next. It says what right-click does, what
"keeping" an image means, and which parts of `DESIGN.md`'s rescue section are
deliberately still unbuilt.

## Why the two arrived together

A context menu is a surface for actions, and before this the wall had one:
`POST /api/items/:id/dismiss`, which clears a flag. Everything else a person
would want from a card — save it, kill it, get it back — is step 6 of the build
order and was never started. So the menu ships with the smallest rescue that
makes it worth opening.

## What right-click does

On the canvas only. The lightbox stays a real `<img>` with the browser's own
menu on it, because saving and copying an image is what that menu is for.

The pick is a read of `chainAt` in `WebglBackend`, which already answers
`[zone, id]`, `[zone]` or `[]` for any screen point. `targetOf` names the three.

Over a card: **Open**, **Pin** (or **Unpin**), **Dismiss the flag** when it
is asking, **Copy path**, **Expire now**. Over a zone or empty sky: **Undo last
expiry**, and nothing else — a menu with no items does not open.

"Unpin" rather than "drop" or "free": both read as throwing the image away,
which is the item directly below it. Dismissing a flag is a separate action and
keeps its own word — it lets go of the attention, not of the image.

Cmd-Z does the undo without the menu.

## What keeping does

**The sweeper skips a kept item and its decay freezes.** `keptAt` on the item
is both facts: `toStackItems` ages a card from `bornAt` to `keptAt` instead of
to now, so a rescued card holds the brightness it had when you rescued it while
everything around it fades.

**The rescue is written to the sidecar** — `kept`, an ISO string beside
`caption` and `attention`. Nothing else survives a daemon restart: `adopt`
re-reads sidecars off disk at startup, so a keep held only in memory would let
the file expire on the next bounce. `adopt` also stops trashing a rescued file
for being older than its TTL, which is the whole of what the rescue buys.

The file does not move. It stays in `~/slop/inbox/<zone>/`, so a kept image is
still one `rm` from gone; what it is safe from is the wall itself.

## Undo

The store holds **one** expiry — the entry and where in the trash it went.
Undo renames the file back, brings the sidecar with it, and re-adds the item
**with a fresh `bornAt`**. Restored at its old one it would already be past its
TTL and the sweeper would take it again within the second, which looks exactly
like undo not working.

It is one deep because the case it covers is watching something die and wanting
it back. Anything older is a trash to browse, and the trash already keeps 24
hours.

## What is deliberately not built

**The cap.** `DESIGN.md` bounds the keep set at twelve, so that keeping
something costs you something. Nothing has ever been kept, so twelve is a guess
about a pressure nobody has felt. The bound goes in after living with a wall
that has any rescue at all, and the menu is where the choice of what to
displace will surface when it does.

**The reserved band.** Pinned items are supposed to move out of the flowing set
into a band of their own. That is arrangement work, not menu work, and the
freeze already makes a kept card legible against its neighbours.

## The parallax

The menu is a [reticul8r](../../../../reticul8r) window: `useReticule` on the
menu box, and the header, the items and their text become planes by nesting
alone.

**Both modes are sliders, under `menu` in the params panel**, because the only
way to judge this is to open the menu and move the pointer. `window` moves the
viewpoint and leaves every box where it is, so a click lands where it was
aimed; `tilt` rotates the deck, which reads harder and moves the target while
you approach it. The default is tilt, deliberately overdone, so there is
something to dial back from rather than up to.

**The rows are coplanar, and that is the point.** A menu is one surface you
read across; rows staircased front to back read as a stack of unrelated cards.
So `fan` stays 0, which is also reticul8r's own default — it will not
staircase siblings by document order.

The depth that is left is the depth that means something: each row is the
plane its highlight paints on, and the label is lifted a step clear of it, so
the selection sits *behind* the words rather than around them. Depth only runs
toward the viewer, so bringing the label forward is how you put the highlight
behind it.

The markup is a shell and a deck: `tilt` rotates a deck *inside* the container,
so the container holds position and perspective and paints nothing, and
everything visible lives on `.menu__deck`.

**React must not own the `class` attribute on anything reticul8r touches.** It
writes `rz-plane` onto every plane, and React setting `className` replaces the
whole attribute rather than editing it, so a re-render strips the class off
whichever element it re-rendered. That row then has no transform: it stops
moving and snaps back to its unscaled size, permanently, because nothing
re-adds the class until the next `refresh()`. Every class in `CardMenu` is
therefore static and all state — the placement, the active row — rides on
`data-` attributes. This bites hardest where it looks most innocent, a
hover highlight.

Two more traps, both of which make the effect vanish silently rather than break
loudly: `overflow` other than `visible`, `opacity` below 1 and `filter`
anywhere above a plane flatten it while the computed `transform-style` still
reads `preserve-3d`. That is why the card's name in the header has no line
clamp. In dev the menu calls `handle.diagnose()` and warns for every plane
something is flattening.

## Placement

`placeMenu` flips the menu across the pointer when it would run off the
viewport, rather than sliding it. A menu that slid would land under the cursor,
and the first item would be whatever the pointer is already sitting on.
