# Video artifacts

Design for holding video on the wall. For whoever implements it; assumes
`DESIGN.md` has been read and does not restate it.

The question it answers: how does an artifact with no still frame reach a
renderer that only draws stills — and where does the motion go instead.

## What changes about the product

`slop capture.mp4` works. The card is a poster frame and never moves, wearing
`▶ 0:12` where the age chip's sibling badge already sits. Opening it plays the
video in the lightbox, muted, with an unmute and a way out to whatever app the
OS would have used.

The wall itself gains no motion. That is the same call the animated GIF already
got and for the same reason: a wall of playing textures buys motion nobody is
looking at.

## Decisions

**A video is a third `kind`, and the wall's second artifact with no pixels of
its own.** `DESIGN.md` states the page's rule — *a page has no pixels, so the
daemon gives it some* — and video is the second instance of it. So the page's
inline special case in `ingest()` becomes one step both kinds share:

```ts
// server/poster.ts
export async function posterFor(kind: Kind, source: string, out: string): Promise<string | null>
```

A picture returns `source`; a page returns `out` via the existing `shootPage`;
a video returns `out` via a new `frameOf`. `null` declines the artifact.
`ingest()` calls it once, feeds what comes back to the picture pipeline
unchanged, and removes anything that was not the source. `shoot.ts` is not
moved or rewritten — `poster.ts` calls it.

Everything downstream of ingest still never learns either kind exists. That was
the whole reason for the page screenshot and it is the whole reason for this.

**The poster is seeked to one second, not to frame 0.** A fade-in or a screen
recording opens on black often enough that frame 0 is a worse default than a
fixed early offset. Under a second, `frameOf` retries at 0. `-ss` goes *before*
`-i` so it is an input seek and costs a container seek rather than a decode of
the first second.

**Width and height come from the poster, never from ffprobe.** A `.mov` off a
phone carries a display matrix: ffprobe reports the stream's pre-rotation size
while ffmpeg writes the poster already rotated. The poster goes through `sharp`
regardless, so `orientedSize` measures it — the existing picture path is the
correct answer here, and reading ffprobe's numbers would be a bug that only
shows on portrait video.

ffprobe is called for exactly one thing: duration.

**`duration` is a new `WallItem` field; `frames` stays the GIF's.** They are
not the same quantity and conflating them would make the badge text a guess. A
container that declares no duration — some `.webm` do not — leaves `duration`
absent and the badge reads a bare `▶`.

**Held containers are the ones Chrome plays:** `.mp4 .m4v .mov .webm`. ffmpeg
would poster a `.mkv` happily and the lightbox would then show a dead player, so
the wall does not hold one. `slop` refuses it at the send naming what is held,
which is the rule the extension check already follows.

**`slop` also refuses a video when ffmpeg is not on `PATH`.** Same rule, same
reason: a file the daemon declines is silently invisible *and* never expires,
because only an adopted artifact is ever trashed. An argument fails in front of
whoever typed it; a missing decoder must too.

**The lightbox opens muted, every time.** Not remembered as unmuted — a side
monitor that makes noise because of something you did yesterday is the failure
this avoids. Muted also means Chrome's autoplay policy never blocks the play, so
there is no case where the video sits on its first frame waiting for a second
click. The unmute is in the meta line and its state persists only within a
session.

**"Open in default app" is a daemon route, not a link.** The browser cannot
call `open`, so `POST /api/open/:id` spawns it — restricted to ids the store
holds, so the route cannot be pointed at an arbitrary path.

**`VideoLightbox` is its own component.** The image path's pan, zoom, drag and
resize state means nothing for a `<video>` with native controls, and a branch
above those hooks would change the hook count when the arrows page from a
picture to a video on the same element. This is the reason `PageLightbox`
already exists and it applies unchanged.

**A video's original goes unstamped**, exactly as a JPEG's does: `stampOriginal`
is PNG-only because writing metadata means re-encoding. The sidecar and the
cache derivative still carry provenance.

## The pieces

**`server/poster.ts`** — `posterFor`, and `frameOf` for the video case.
`frameOf` spawns `ffmpeg -ss <at> -i <src> -frames:v 1 -y <out>`, awaits exit,
and confirms the file is non-empty; it retries once at `-ss 0` when the first
pass writes nothing. Unlike `shootPage` this can await its child — ffmpeg exits
when it is done, which Chrome does not. Bounded by `SLOP_POSTER_TIMEOUT_MS`.

**`server/probe.ts`** — `durationOf(path): Promise<number | null>`, parsing
`ffprobe -v error -show_format -of json`'s `format.duration` seconds into ms.
Null for anything it cannot read, which is a normal outcome and not a warning.

**`server/kind.ts`** — `VIDEO_EXT`, `Kind` gains `'video'`, `HELD_EXT` picks
them up. `kind.test.ts` already holds `bin/slop` to `HELD_EXT` and keeps doing
so.

**`shared/duration.ts`** — `formatClock(ms)`: `0:12`, `4:03`, `1:02:33`. The
existing `formatDuration` writes `5m` for TTLs and is the wrong vocabulary for a
runtime.

**`shared/protocol.ts`** — `kind?: 'page' | 'video'` and `duration?: number`.

**`server/ingest.ts`** — the page branch becomes the `posterFor` call; `duration`
is probed for a video and set on the item.

**`server/index.ts`** — `POST /api/open/:id`.

**`src/backends/WebglBackend.tsx`** — the play badge's predicate becomes
`frames || kind === 'video'`, and its text `▶ 0:12` where a duration exists.
A string and a predicate, not new badge machinery.

**`src/Lightbox.tsx`** — `VideoLightbox`, dispatched on `kind` beside the page
case.

**`src/lightbox-meta.ts`** — the runtime joins the meta line.

**`bin/slop`** — `held_ext` gains the four; a video with no ffmpeg is refused.

**`DESIGN.md`** — the ingest contract's "an artifact is a picture or a page"
paragraph becomes three kinds, and states the unstamped original.

## Testing

Unit, in the existing style — pure functions with their own files and their own
tests: `formatClock`, `kindOf` over the new extensions, `durationOf`'s parse of
a captured ffprobe payload, and `posterFor`'s dispatch with its runners
injected. `frameOf` and `durationOf` get one integration test each against a
tiny fixture video generated by ffmpeg at test time, skipped when ffmpeg is
absent so the suite still runs on a machine without it.

The route gets the coverage the other routes have. The lightbox and the badge
are checked in the app.

## Not doing

**No transcode.** `/orig` streams the file as it landed; `res.sendFile` already
answers Range requests, so seeking works with no server change. A long screen
recording is hundreds of megabytes over a localhost socket each time it is
opened, and it still expires on the normal TTL, so this is bandwidth rather than
disk. A size cap at the send is the other answer and is not taken.

**No playback on the wall.** Left as an axis: the poster path is what ships, and
video textures would be a params-table row later, the way `attention` shipped
with one level named for a second.

**No frame strip.** A card that samples several moments no longer matches the
artifact's own aspect, which every arrangement assumes.

## Traps

**ffmpeg decodes untrusted input.** These come from the same agents that already
write to the inbox, so this is a note for when that stops being true.

**`-ss` after `-i` is an output seek** and decodes everything it skips. On a long
video that is the difference between instant and a minute holding an ingest slot.

**A container can declare no duration.** Treat null as ordinary.
