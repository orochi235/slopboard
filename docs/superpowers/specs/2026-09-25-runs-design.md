# Runs

Design for reviewing a batch of renders on the wall: one card holding many
takes, each with its own question. For whoever implements it; assumes
`DESIGN.md` has been read and does not restate it.

The question it answers: an agent produces sixty renders and wants a verdict on
each one. Sixty cards is spam and sixty lightbox interrupts is worse — so what
does one card holding sixty renders look like, and how does a verdict get back
to the agent that asked?

It spans two repos. Everything under "The wall" is `~/src/slopboard`;
everything under "The caller" is `~/src/brick-icons`, which is the first
consumer and teaches slopboard nothing about LEGO.

## What changes about the product

`slop --run sweep-3 --ask "how does this read?" --choice worse --choice better
--why FILE` puts a card on the wall. The next such send with the same run id
adds a **take** to that same card rather than a second card. The card wears
`⧉ 3/12` where the video's `▶ 0:12` already sits, and shows the take you would
review next.

Opening it is a carousel: `←`/`→` page the takes, the question panel sits under
the picture with its choices as chips and a free-text box beneath them, and a
chip click — or its number key — sends the verdict and opens the next
unanswered take. Twelve verdicts is twelve keystrokes without leaving the
lightbox, and `0` drops one without a verdict.

Under the chips sits the way out of the wall: `Open in LDView`, and a link to
whatever the sender said this take is about.

In brick-icons, `brick-icons render --review PART...` sends the run and prints
the verdicts when it closes. `brick_icons.review.review()` is the same thing
for a script.

## The wall

**A run is a fourth `kind`, and the first artifact that grows after it lands.**
`page`, `video` and `mesh` are each one file the daemon gives a poster; a run is
many files sharing one card. Nothing in the ingest contract appends to a live
item today, and this is the one genuinely new mechanic here.

```ts
// shared/protocol.ts
export type Take = {
  id: string
  url: string        // the thumbnail, as a picture's own
  origUrl: string
  name: string       // the source file's name: the part number, for brick-icons
  at: number
  w: number
  h: number
  question?: string
  choices?: string[]
  /** The free-text box's placeholder. Absent means the take offers no box. */
  why?: string
  reply?: Reply
  /** Apps the sender offered, by `open -a` name, each with the file to hand
   *  it. The wall may ask the daemon for one of these and no other. */
  apps?: { name: string; path: string }[]
  /** Somewhere on the web this take came from or points at. */
  links?: { label: string; url: string }[]
}
```

`WallItem` gains `takes?: Take[]` and `run?: { label?: string; of?: number }`.

**They are `takes`, not frames.** `WallItem.frames` already means how many an
animated GIF plays, and conflating the two would make the badge a guess — the
same call `duration` got against `frames` for video.

**A take ingests exactly like a picture and then is appended instead of
inserted.** `ingest()` runs the existing pipeline — thumbnail, `orientedSize`,
XMP, sidecar — and hands the result to the store as a take when the sidecar
names a run. Downstream of that, a take is a picture with a question on it.

**A run's item id is derived from its zone and run id**, so an append is a
lookup rather than a search. The create-or-append is one synchronous store
call with every `await` already finished before it, which is what stops two
takes landing at once from both creating the run — the failure would be two
cards with the same name and half the takes each.

**The poster is the first unanswered take**, so the card shows what it wants
from you and works through the run visibly as you answer. When every take is
answered it settles on the last. The store recomputes the item's `url`,
`origUrl`, `w` and `h` from that take whenever takes or replies change and
broadcasts them; the renderer is never taught the rule.

**The badge reads `⧉ 3/12`** — which take is on the card, out of how many the
run said were coming. A run that never said reads `⧉ 3/7+`, since the count so
far is true and the total is not known.

**A run alerts once.** The first take's attention level applies; every append
lands silently. Without this a run at `urgent` is sixty lightbox interrupts,
which is the thing this design exists to prevent.

**The run's TTL restarts on every append** — a run still producing is not
stale — and, by the existing rule that an open question has no TTL, any
unanswered take holds the card. Dismissing closes every open take at once and
gives the card a whole fresh TTL. `slop` refuses a take past 60 in one run:
without a cap the only bound on a card's size is how long the agent runs.

### Asking

**A question belongs to a take, not to a run.** A run whose takes each carry
the same question is the common case and the caller's business to repeat; a run
whose takes ask different things — or ask nothing, which is a slideshow — costs
nothing extra this way.

**An ask can carry a choice and a comment.** `--why` adds a free-text box under
the chips; `--why "what's off about it?"` sets its placeholder. `Reply` becomes
`{ status, choice?, text, at }`: `choice` is the chip, `text` is the box. A
plain free-text ask still answers into `text` with no `choice`, so nothing
existing moves.

**The chip is the submit.** Clicking one — or pressing its number, `1`–`9` —
sends the reply with whatever is in the box, empty or not. Text alone cannot
submit. One rule instead of two, and it is what makes advancing unambiguous:
there is no state in which the wall must guess whether you are done.

**Answering advances.** The reply holds on screen for the beat it already
holds, then the next unanswered take opens. The last one plays the lightbox
out, as answering does today.

**`dismiss` sits beside the chips, not among them.** A take you want gone
without a verdict is not one of the outcomes, so it is set off by a gap at the
end of the row and takes `0` rather than a key among the chips. It closes that
take's question with the existing `dismissed` status — so a caller already
branching on `dismissed` for a question it never got an answer to needs no new
case — and advances like any other reply.

This is per-take. The lightbox's own dismiss and the flag row's `×` still close
the whole card, which for a run means every open take at once. Two scopes, and
the panel says which is which: the chip row's `dismiss` is inside the picture's
panel, the card's is on the card.

**The answer file gains a third part.** `~/slop/answers/<name>` becomes line 1
status, line 2 the choice (blank when there is none), line 3 onward the text —
`sed -n 2p` and `tail -n +3`, so `bin/slop` still needs no JSON parser. `slop
--ask` prints the answer alone as it does now; `slop --ask --json` prints the
whole reply, for a caller that wants both fields.

⚠️ A question open *across* the daemon restart that ships this misparses its
answer: line 2 of an old free-text answer reads as a choice. Restart with no
open questions, or eat one bad verdict.

### Getting out of the wall

A verdict is often not the end of it: the render is wrong and the next move is
the source file in the app that made it, or the page that says what the part
should look like. The lightbox panel carries a row for both.

**`--app "LDView"` offers an app; `--app "LDView=parts/3001.dat"` says what to
hand it.** Bare, it hands the artifact itself — the same file the existing
`Open` would have used, but to a named app instead of the OS default. `slop`
resolves the path at the send, because it is relative to the caller's working
directory and the daemon does not share it.

**The daemon runs `open -a <name> <path>` and never a command line.** The
existing `/api/items/:id/open` route takes no path from the browser at all —
it resolves one the store holds — and this keeps that property: the route takes
a take and an app *index*, and refuses anything the sender did not name. A
wall page cannot name an app or a file the artifact did not offer.

What does widen is the store now holding paths outside `~/slop`: the sender
declares a file in its own repo and the daemon will open it. The sender is the
same agent that writes into the inbox, so this is inside the existing trust
boundary rather than past it — but it is the first thing in the store that the
daemon did not put there, and it is worth knowing that is what changed.

**A failed open toasts.** `open -a` fails when there is no such app, and an
alert's spawn failure is swallowed today because a missing `afplay` should
never cost the arrival. A button that silently does nothing is a different
thing: it says "no app named LDView" in the toast row the alerts already use.

**`--link "part 3001=https://rebrickable.com/parts/3001/"`** adds an anchor;
without an `=` the label is the URL's host. Repeat either flag for more than
one. Only `http` and `https` — `slop` refuses anything else at the send, since
a `file:` link a browser silently blocks is exactly the artifact that wanted
`--app`.

Both are per-take, and both live in the lightbox. The card's right-click menu
gains the poster take's apps beside the `Open` already there; links stay in the
lightbox, where there is room to read them.

### Protocol

- `{ type: 'take'; id: string; take: Take; url: string; origUrl: string; w: number; h: number }`
  — a take appended, with the poster the store recomputed.
- `reply` gains `take?: string`. Absent is a question on the item itself, which
  is every question today.

## The caller

**`brick_icons/review.py` is the mechanism and `--review` is the one caller
that ships.**

```python
review(path, question=..., choices=VERDICTS, why=..., run=..., mode="run") -> Verdict
```

`Verdict` is `(status, choice, text)` — `status` because a take can be
dismissed, in which case there is no choice and the caller decides whether a
take nobody judged counts as a pass. The default `choices` are
`no change, worse, neutral, better, fixed`, passed as five `--choice` flags in
that order.

**They are named outcomes, not points on a scale.** The order is the order they
are drawn and nothing else: no rank, no distance between neighbors, nothing to
compare or average. A caller branches on the exact string, which is already the
rule for choices — `one question, one answer` in `DESIGN.md` — and any
downstream code that does arithmetic on a verdict is reading a quantity that
was never sent.

The number keys are positional accelerators for the same reason a menu's are:
`2` means the second chip, not a value of 2.

slopboard ships no named set of these: a comparative vocabulary is not the
wall's until a second consumer wants the same one. A first look at a render
with nothing to compare against passes `keep, redo` instead.

Three modes, `run` when `--review` is bare:

| mode | what it does | when |
|---|---|---|
| `one` | blocks per render; render N+1 waits on verdict N | chasing one defect, want to stop early |
| `run` | sends takes as they render, waits at the end for every verdict | the default: review the sweep while it renders |
| `loose` | sends and returns; `brick-icons review --collect <run>` reads the verdicts later | a long render to come back to |

The helper waits on the answer files itself, since it knows the paths `slop`
printed. `bin/slop` gains no way to wait on many.

**`loose` needs a manifest**, `.cache/review/<run>.json`, mapping each take's
destination path to the part and the parameters that made it — otherwise a
verdict collected an hour later names a file in the inbox and nothing else.
Writing one prunes all but the last 10 runs, which is what bounds the
directory.

**No verdict is written anywhere yet.** `review()` returns them and
`--review` prints a table. What a verdict means for `corpus.db` is undecided,
and deciding it later is a caller change rather than a protocol one.

## Not built

- **A run-level question** stamped onto each take. Sugar over a loop in the
  caller; add it when writing the loop is annoying enough to notice.
- **A plugin system in slopboard.** One generic kind and a client that shells
  `bin/slop` is the whole integration; an extension architecture for one
  consumer is inventory with no reader.
- **A take that expires on its own.** The run is the unit of lifetime. Per-take
  expiry would put holes in the middle of a carousel.

## Testing

- The store's create-or-append under two takes arriving in the same tick — the
  race the derived id exists to prevent.
- Poster derivation: first unanswered, last when all are answered, recomputed
  on reply as well as on append.
- Badge text for a known total, an unknown one, and a finished run.
- The answer file's three parts, round-tripped through `bin/slop`, including a
  free-text answer whose first line would otherwise read as a choice.
- The lightbox carousel: number keys submit with the box's contents, answering
  advances to the next *unanswered* take rather than the next one, the last
  answer closes, and `0` dismisses one take without touching the others.
- The open route refuses an app the take did not offer, and refuses a path the
  sender did not declare — the property the existing route has and this must
  not lose.
- `slop` refuses a `file:` or `javascript:` link at the send.
- The helper against a fake `slop` on `PATH`, one mode each.
