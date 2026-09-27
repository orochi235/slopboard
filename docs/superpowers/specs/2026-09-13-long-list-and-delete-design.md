# Paging the wall as one list, and deleting from the lightbox

For whoever works on transom's navigation or its expiry. It says what the
lightbox's keys do across piles, what Delete does, and how deep undo goes.
Decided 2026-09-13.

## One list, as an option

A band row labeled `list`, keyed `L`, turns it on. Off by default, remembered
per browser. It changes only what ← and → do with a card open.

- **On:** every card on the wall is one list. Piles chain in reading order —
  left to right by where their front cards sit, then the next row — and each
  pile runs deepest to front, the way its cards step across the screen. So →
  past a pile's front card opens the next pile's deepest, and ← past a pile's
  deepest opens the previous pile's front. Every step reverses exactly. The
  list ends at the first and last card on the wall; it does not wrap.
- **Off:** a pile clamps at both ends, as before.

The camera behind the lightbox already frames whichever pile holds the open
card, so crossing a boundary carries the backdrop with no extra work.

While the list is on and a card is open, the band's count is the whole wall,
because that is what paging walks.

## Shift + arrow

With a card open, shift and an arrow (or WASD) opens the front card of the
neighboring pile in that direction — all four. On or off regardless of the list.
At the pile rung it does what the plain arrow does.

## Delete

Backspace or Delete, with a card open, expires it. The lightbox first moves to
the card ← would open, else the one → would, then asks the daemon — so the
lightbox never closes and reopens. With no card left to move to, it steps out.

A page artifact forwards Backspace, Delete and the shift key along with the
arrows, since a keystroke inside its sandboxed frame never reaches the wall.

## Undo

The daemon holds the last **ten** expiries a person asked for: Delete, the
menu's *Expire now*, and *Expire the zone* (one step for the whole zone).
A TTL running out never enters the list. Before this the store held one step
and the sweeper overwrote it, so an undo after a deliberate expiry would
restore whatever had timed out since.

Cmd-Z walks back through the list. `/api/undo` answers with the ids it
restored; if a card is open, the wall opens the restored one once it arrives.
A restored card comes back with a fresh `bornAt`, as before, so it lands at
the front of its pile. The list is memory only; the trash keeps 24 hours
regardless.

## Where it lives

- `src/nav/list.ts` — reading order, paging, the shift jump and the card after
  a delete, as pure functions over the piles and their front-card boxes.
- `src/nav/keys.ts` — which keystrokes delete and toggle the list.
- `server/store.ts` — the undo stack.
- `shared/page-keys.ts`, `server/page-keys.ts` — the forwarded keys.
- `WebglBackend` wires the keys; `TopBar` carries the row.
