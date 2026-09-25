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
lightbox.

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

**The answer file gains a third part.** `~/slop/answers/<name>` becomes line 1
status, line 2 the choice (blank when there is none), line 3 onward the text —
`sed -n 2p` and `tail -n +3`, so `bin/slop` still needs no JSON parser. `slop
--ask` prints the answer alone as it does now; `slop --ask --json` prints the
whole reply, for a caller that wants both fields.

⚠️ A question open *across* the daemon restart that ships this misparses its
answer: line 2 of an old free-text answer reads as a choice. Restart with no
open questions, or eat one bad verdict.

### Protocol

- `{ type: 'take'; id: string; take: Take; url: string; origUrl: string; w: number; h: number }`
  — a take appended, with the poster the store recomputed.
- `reply` gains `take?: string`. Absent is a question on the item itself, which
  is every question today.

## The caller

**`brick_icons/review.py` is the mechanism and `--review` is the one caller
that ships.**

```python
review(path, question=..., choices=SCALE, why=..., run=..., mode="run") -> Verdict
```

`Verdict` is `(choice, text)`. The default scale is
`worse, no change, neutral, better, fixed` — passed as five `--choice` flags.
slopboard ships no named scale: a five-point comparative ramp is not the wall's
vocabulary until a second consumer wants the same one. A first look at a render
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
  answer closes.
- The helper against a fake `slop` on `PATH`, one mode each.
