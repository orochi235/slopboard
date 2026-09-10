# HTML Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **BUILT AND ON `main`**, 2026-09-06, `f0f0e4a..0da09de`. Every task below is
> ticked. `DESIGN.md`'s ingest contract is the reference for what a page
> artifact is; this file is the record of how it got there.

**Goal:** Put a self-contained HTML page on the wall — a card you can see from
across the room, and a page that actually runs when you open it.

**Architecture:** The daemon shoots the page once with headless Chrome and hands
the resulting PNG to the sharp pipeline that already exists, so the card, the
LOD tiers, the texture budget and the aspect are untouched — a page is an image
to everything in the scene. `/orig` keeps serving the source file, which for a
page is the HTML itself, so the lightbox swaps its `<img>` for an `<iframe>`
pointing at the same URL and the page runs live. The sandbox is declared by
whoever pushed the artifact and carried through the sidecar.

**Tech Stack:** Chrome (already installed, already spawned by `server/alert.ts`),
sharp, express, React 19, vitest.

---

## Decisions already made

Settled by the owner. Do not reopen them; if one turns out to be wrong, say so
and stop rather than picking a different one.

- **The card is a screenshot of the page**, not a drawn title plate and not a
  new card treatment in the renderer. This is what keeps the whole render half
  of the codebase out of the change.
- **Opening one runs it live** in an iframe. A frozen screenshot at full size
  was the alternative and was rejected: an HTML artifact you cannot poke at has
  little reason to be HTML.
- **The sandbox is the pusher's call, not the wall's.** Whoever sends a page
  says what it is allowed to do; the wall applies what it was told. This is why
  there is no security model in this plan beyond carrying a string.

## What it collides with

Four places in the codebase assume an artifact is an image. Nothing else does.

- `server/ingest.ts:17` — `IMAGE_EXT` is the gate. Anything else is silently
  skipped, which is why dropping an `.html` in the inbox does nothing today.
- `server/ingest.ts` — the pipeline is sharp end to end: decode, resize to
  `maxEdge`, webp, XMP stamp.
- `src/Lightbox.tsx` — an `<img src="/orig/${id}">`, with pan and zoom over it.
- `WallItem.w`/`h` — the artifact's own pixels, which an HTML file does not have.

The zone, TTL, attention, keep and expiry halves care about none of this. A page
is an item like any other to all of them.

## Traps, measured not assumed

Both of these were tested by hand on 2026-09-06 against Chrome 152.0.7977.76.

- **`--screenshot` writes the PNG and then does not exit.** Both `--headless=new`
  and `--headless=old` were still running 30 seconds after the file was complete
  and correct on disk, with and without `--virtual-time-budget`. So the shot is
  not "spawn and await" — it is spawn, poll for the file, kill. A plain `await`
  on process exit hangs the daemon's ingest gate forever, and the gate is only
  three deep (`config.ingestAtOnce`), so three HTML files would stop the wall
  accepting anything at all.
- **`--screenshot` captures the viewport, not the page.** A short page in a
  1280×800 window gives a card that is mostly empty background. Full-page
  capture needs CDP (`Page.captureBeyondViewport`), which needs a driver, which
  is a dependency this plan deliberately does not take. The window size is a
  param so the answer is a drag; the emptiness is a known cost, not a bug.

## Global Constraints

- **Import extensions:** slopboard source imports carry explicit `.ts`/`.tsx`
  extensions. Match the existing files.
- **Path aliases:** `@/*` → `./src/*`, `@shared/*` → `./shared/*`. Use them;
  never write `../../`.
- **Editing anything under `shared/` or `server/` restarts the daemon**, because
  `tsx watch` follows imports. Confirm with the worker pid (`pgrep -f tsx`), not
  the supervisor's, which never changes.
- **`adopt` reads mtime**, so nothing may rewrite a file in the inbox without
  putting mtime back. This plan writes no originals, which is why it does not
  have to.
- **No new numbers in a source file.** Anything tunable belongs in
  `StackParams` (`src/params.ts`) or `server/config.ts`.

---

### Task 1: Tell a page from a picture

One place decides what kind of file this is, so the gate in `ingest` and the
branch in the lightbox never disagree.

**Files:**
- Create: `server/kind.ts`
- Create: `server/kind.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// server/kind.test.ts
import { describe, expect, it } from 'vitest'
import { kindOf } from './kind.ts'

describe('kindOf', () => {
  it('reads the extensions the wall already holds as pictures', () => {
    expect(kindOf('/slop/inbox/z/a.png')).toBe('image')
    expect(kindOf('/slop/inbox/z/a.JPG')).toBe('image')
    expect(kindOf('/slop/inbox/z/a.webp')).toBe('image')
  })

  it('reads a self-contained page', () => {
    expect(kindOf('/slop/inbox/z/a.html')).toBe('page')
    expect(kindOf('/slop/inbox/z/a.HTM')).toBe('page')
  })

  it('is null for anything the wall cannot hold', () => {
    // The sidecar lands in the same directory and must never be ingested.
    expect(kindOf('/slop/inbox/z/a.png.slop.json')).toBe(null)
    expect(kindOf('/slop/inbox/z/a.pdf')).toBe(null)
    expect(kindOf('/slop/inbox/z/a')).toBe(null)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/kind.test.ts`
Expected: FAIL, "Failed to load ./kind.ts"

- [x] **Step 3: Write the implementation**

```ts
// server/kind.ts
import { extname } from 'node:path'

/**
 * What the wall does with a file, or null for one it does not hold.
 *
 * A page is an image to everything downstream of ingest — it is shot once and
 * the shot goes through the same pipeline — so this is the only place the two
 * are ever told apart on the daemon side.
 */
export type Kind = 'image' | 'page'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tiff'])
const PAGE_EXT = new Set(['.html', '.htm'])

export function kindOf(path: string): Kind | null {
  const ext = extname(path).toLowerCase()
  if (IMAGE_EXT.has(ext)) return 'image'
  if (PAGE_EXT.has(ext)) return 'page'
  return null
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/kind.test.ts`
Expected: PASS, 3 tests

- [x] **Step 5: Point ingest at it, so there is one gate rather than two**

In `server/ingest.ts`, delete the `IMAGE_EXT` constant at line 17 and replace
the first line of `ingest`:

```ts
// was: if (!IMAGE_EXT.has(extname(sourcePath).toLowerCase())) return null
const kind = kindOf(sourcePath)
if (kind === null) return null
```

Add the import beside the others:

```ts
import { kindOf } from './kind.ts'
```

`extname` is still used by `stampOriginal`; leave that import alone.

- [x] **Step 6: Run the server tests**

Run: `npx vitest run server`
Expected: PASS. An `.html` in the inbox now reaches sharp and is skipped with
`[ingest] skipped …` on the console — that is correct for this task, and Task 3
is what makes it land.

- [x] **Step 7: Commit**

```bash
git add server/kind.ts server/kind.test.ts server/ingest.ts
git commit -m "name the kinds of artifact the wall holds"
```

---

### Task 2: Shoot a page to a PNG

The argv is pure and tested; the spawn is not, and is kept as small as a thing
can be that has to poll a filesystem.

**Files:**
- Create: `server/shoot.ts`
- Create: `server/shoot.test.ts`
- Modify: `server/config.ts`

- [x] **Step 1: Add the config the shot reads**

In `server/config.ts`, inside the exported `config` object, after `wallProfile`:

```ts
  /** How a page is turned into a picture. Chrome rather than a driver: it is
   *  already installed, already spawned for the alerts, and a headless driver
   *  is a 150MB dependency for one screenshot. */
  shotBrowser:
    process.env.SLOP_SHOT_BROWSER ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  /** The viewport a page is shot in. `--screenshot` captures the viewport and
   *  not the document, so a short page leaves empty card. */
  shotWidth: Number(process.env.SLOP_SHOT_WIDTH ?? 1280),
  shotHeight: Number(process.env.SLOP_SHOT_HEIGHT ?? 800),
  /** Chrome does not exit after writing the shot, so the daemon kills it. This
   *  is how long the page gets to finish painting first. */
  shotTimeoutMs: Number(process.env.SLOP_SHOT_TIMEOUT_MS ?? 15_000),
```

- [x] **Step 2: Write the failing test**

```ts
// server/shoot.test.ts
import { describe, expect, it } from 'vitest'
import { shotArgv } from './shoot.ts'

const argv = shotArgv({
  browser: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  pagePath: '/slop/inbox/z/page.html',
  outPath: '/tmp/shot.png',
  profileDir: '/tmp/slop-shot-abc',
  width: 1280,
  height: 800,
})

describe('shotArgv', () => {
  it('leads with the browser and ends with the page as a file URL', () => {
    expect(argv[0]).toMatch(/Google Chrome$/)
    expect(argv[argv.length - 1]).toBe('file:///slop/inbox/z/page.html')
  })

  it('asks for a headless shot at the given size', () => {
    expect(argv).toContain('--headless=new')
    expect(argv).toContain('--screenshot=/tmp/shot.png')
    expect(argv).toContain('--window-size=1280,800')
  })

  it('gives every shot its own profile, so two never fight over one lock', () => {
    expect(argv).toContain('--user-data-dir=/tmp/slop-shot-abc')
  })

  it('escapes a path that would otherwise break the file URL', () => {
    const spaced = shotArgv({
      browser: '/c',
      pagePath: '/slop/inbox/my zone/a b.html',
      outPath: '/tmp/s.png',
      profileDir: '/tmp/p',
      width: 10,
      height: 10,
    })
    expect(spaced[spaced.length - 1]).toBe('file:///slop/inbox/my%20zone/a%20b.html')
  })
})
```

- [x] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/shoot.test.ts`
Expected: FAIL, "Failed to load ./shoot.ts"

- [x] **Step 4: Write the implementation**

```ts
// server/shoot.ts
import { spawn } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from './config.ts'

export type ShotOpts = {
  browser: string
  pagePath: string
  outPath: string
  profileDir: string
  width: number
  height: number
}

/** Pure, so the flags are readable and testable without launching anything. */
export function shotArgv(o: ShotOpts): [string, ...string[]] {
  return [
    o.browser,
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    // A page may animate forever; this is the paint it is judged on.
    '--virtual-time-budget=2000',
    `--window-size=${o.width},${o.height}`,
    `--screenshot=${o.outPath}`,
    // Its own profile per shot: a shared one is locked by the first Chrome to
    // take it, and the second silently produces nothing.
    `--user-data-dir=${o.profileDir}`,
    pathToFileURL(o.pagePath).href,
  ]
}

/** The file's size, or null while it does not exist yet. */
async function sizeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size
  } catch {
    return null
  }
}

/**
 * A PNG of the page, or null.
 *
 * Chrome writes the shot and then keeps running — measured on 152.0.7977.76,
 * in both headless modes, with and without a virtual time budget. So this
 * polls for the file and kills the process rather than awaiting its exit. An
 * await here would hold one of the three ingest slots forever.
 */
export async function shootPage(pagePath: string, outPath: string): Promise<boolean> {
  const profileDir = await mkdtemp(join(tmpdir(), 'slop-shot-'))
  const argv = shotArgv({
    browser: config.shotBrowser,
    pagePath,
    outPath,
    profileDir,
    width: config.shotWidth,
    height: config.shotHeight,
  })

  const [cmd, ...args] = argv
  const child = spawn(cmd, args, { stdio: 'ignore' })
  const deadline = Date.now() + config.shotTimeoutMs
  let lastSize = -1
  let done = false

  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150))
      const size = await sizeOf(outPath)
      if (size === null) continue
      // Two readings the same means the write finished. One reading is not
      // enough: Chrome creates the file before it has written the pixels.
      if (size > 0 && size === lastSize) {
        done = true
        break
      }
      lastSize = size
    }
  } finally {
    child.kill('SIGKILL')
    await rm(profileDir, { recursive: true, force: true }).catch(() => {})
  }

  if (!done) console.warn(`[shoot] no picture from ${pagePath} in ${config.shotTimeoutMs}ms`)
  return done
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/shoot.test.ts`
Expected: PASS, 4 tests

- [x] **Step 6: Shoot one by hand, because no test can**

```bash
cat > /tmp/probe.html <<'HTML'
<!doctype html><meta charset=utf-8><title>Probe</title>
<style>body{margin:0;background:#0b1020;color:#e2e8f0;font:48px system-ui}</style>
<h1 style="padding:40px">probe</h1>
<script>document.querySelector('h1').textContent += ' — JS ran'</script>
HTML
npx tsx -e "import {shootPage} from './server/shoot.ts'; console.log(await shootPage('/tmp/probe.html','/tmp/probe.png'))"
sips -g pixelWidth -g pixelHeight /tmp/probe.png
```

Expected: `true`, then `1280` and `800`. Open `/tmp/probe.png` and confirm it
reads "probe — JS ran": if the script did not run, the virtual time budget is
too short for this Chrome and the number is the thing to change.

Confirm no Chrome is left behind: `pgrep -fl slop-shot` should print nothing.

- [x] **Step 7: Commit**

```bash
git add server/shoot.ts server/shoot.test.ts server/config.ts
git commit -m "shoot a page to a picture with the browser already on the box"
```

---

### Task 3: Ingest a page

The shot goes through the pipeline that already exists. `/orig` keeps serving
the source, which for a page is the HTML — that is what makes the lightbox work
in Task 5 without a new route.

**Files:**
- Modify: `server/ingest.ts`
- Modify: `shared/protocol.ts`

- [x] **Step 1: Add the kind to the item**

In `shared/protocol.ts`, inside `WallItem`, after `sha?: string`:

```ts
  /** Absent for a picture, which is the ordinary case. `page` means `/orig`
   *  serves an HTML file the lightbox runs, and `url` is a shot of it. */
  kind?: 'page'
  /** What the pusher said the page may do, verbatim into the iframe's
   *  `sandbox` attribute. Absent means the wall's own default applies. */
  sandbox?: string
```

- [x] **Step 2: Shoot before the pipeline**

In `server/ingest.ts`, replace the `try` block that produces `info` with this.
The two new lines are the shot and the `pixelPath` it feeds:

```ts
  let info: sharp.OutputInfo
  let source: { w: number; h: number } | null = null
  // A page has no pixels of its own, so it gets some. Everything below this
  // line is the picture pipeline unchanged, which is the point.
  const shotPath = join(config.cache, `${id}.shot.png`)
  if (kind === 'page' && !(await shootPage(sourcePath, shotPath))) {
    // A shot that timed out may have left a half-written file behind.
    await rm(shotPath, { force: true }).catch(() => {})
    return null
  }
  const pixelPath = kind === 'page' ? shotPath : sourcePath

  try {
    source = orientedSize(await sharp(pixelPath).metadata())
    info = await sharp(pixelPath)
      .rotate()
      .resize({
        width: config.maxEdge,
        height: config.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .withXmp(xmp)
      .webp({ quality: 82 })
      .toFile(cachePath)
  } catch (err) {
    console.warn(`[ingest] skipped ${basename(sourcePath)}: ${(err as Error).message}`)
    return null
  } finally {
    // The shot only ever fed the webp. Keeping it would double the cache for
    // every page on the wall.
    if (kind === 'page') await rm(shotPath, { force: true }).catch(() => {})
  }
```

Add to the imports:

```ts
import { shootPage } from './shoot.ts'
```

and add `rm` to the existing `node:fs/promises` import.

- [x] **Step 3: Carry the kind and the sandbox onto the item**

In the `const item: WallItem = {` literal, beside the other conditional spreads:

```ts
    ...(kind === 'page' ? { kind: 'page' as const } : {}),
    ...(kind === 'page' && sidecar?.sandbox ? { sandbox: sidecar.sandbox } : {}),
```

- [x] **Step 4: Let the sidecar carry a sandbox**

In `server/sidecar.ts`, add `'sandbox'` to the key list in `parseStamp`:

```ts
  for (const key of ['caption', 'zone', 'repo', 'sha', 'attention', 'note', 'kept', 'sandbox'] as const) {
```

In `server/xmp.ts`, add `sandbox?: string` to the `Stamp` type so the key is
carried rather than dropped. It is not written into the XMP — an HTML file is
never stamped, since `stampOriginal` returns early for anything but a PNG.

- [x] **Step 5: Run the server tests**

Run: `npx vitest run server`
Expected: PASS.

- [x] **Step 6: Land one on the real wall**

```bash
cp /tmp/probe.html ~/slop/inbox/slopboard/probe.html
```

Expected: the daemon logs `[arrive] slopboard/… 1280x800`, and a card of the
probe page appears in the `slopboard` zone. Confirm `~/slop/.cache` holds a
`.webp` for it and **no** `.shot.png`.

- [x] **Step 7: Commit**

```bash
git add server/ingest.ts server/sidecar.ts server/xmp.ts shared/protocol.ts
git commit -m "hold a self-contained page as an artifact"
```

---

### Task 4: Run the page in the lightbox

**Files:**
- Modify: `src/Lightbox.tsx`
- Modify: `src/lightbox.css`
- Create: `src/lightbox-sandbox.ts`
- Create: `src/lightbox-sandbox.test.ts`

- [x] **Step 1: Write the failing test for the sandbox rule**

```ts
// src/lightbox-sandbox.test.ts
import { describe, expect, it } from 'vitest'
import { sandboxFor } from '@/lightbox-sandbox.ts'

describe('sandboxFor', () => {
  it('runs a page that asked for nothing, without giving it the wall', () => {
    expect(sandboxFor(undefined)).toBe('allow-scripts')
  })

  it('takes what the pusher asked for', () => {
    expect(sandboxFor('allow-scripts allow-forms')).toBe('allow-scripts allow-forms')
  })

  it('lets a pusher turn the sandbox off outright', () => {
    expect(sandboxFor('none')).toBe(null)
  })

  it('treats an empty string as nothing asked for', () => {
    expect(sandboxFor('')).toBe('allow-scripts')
    expect(sandboxFor('   ')).toBe('allow-scripts')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lightbox-sandbox.test.ts`
Expected: FAIL, "Failed to load @/lightbox-sandbox.ts"

- [x] **Step 3: Write the implementation**

```ts
// src/lightbox-sandbox.ts

/** What a page gets when its pusher said nothing: it runs, but it is not
 *  same-origin, so it cannot read the wall's stored tuning. */
const DEFAULT = 'allow-scripts'

/**
 * The `sandbox` attribute for a page, or null for no attribute at all.
 *
 * Whoever pushes an artifact is responsible for saying what it may do; the
 * wall applies what it was told and does not second-guess it. `none` is how a
 * pusher says the page needs the full run of the frame.
 */
export function sandboxFor(asked: string | undefined): string | null {
  const text = (asked ?? '').trim()
  if (text === '') return DEFAULT
  if (text === 'none') return null
  return text
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lightbox-sandbox.test.ts`
Expected: PASS, 4 tests

- [x] **Step 5: Branch the lightbox on the kind**

In `src/Lightbox.tsx`, immediately after the `const zoomed = …` line, return a
separate tree for a page. It is a separate tree rather than a swapped element
because none of the pan, zoom, drag or resize state means anything for a frame
that scrolls itself:

```tsx
  if (item.kind === 'page') {
    const sandbox = sandboxFor(item.sandbox)
    return (
      <div className="lightbox" role="dialog" aria-modal="true" aria-label="Page">
        <iframe
          className="lightbox__page"
          src={`/orig/${item.id}`}
          title={item.name || 'page'}
          {...(sandbox === null ? {} : { sandbox })}
        />
        <div className="lightbox__meta">
          {metaOf(item, now).map((part) => (
            <span className="lightbox__metaPart" key={part}>
              {part}
            </span>
          ))}
        </div>
        {item.name && <figcaption className="lightbox__caption">{item.name}</figcaption>}
      </div>
    )
  }
```

Add the import:

```ts
import { sandboxFor } from '@/lightbox-sandbox.ts'
```

- [x] **Step 6: Give the frame a box**

In `src/lightbox.css`, beside `.lightbox__port`:

```css
/* Inset rather than full-bleed: the meta line above and the caption below are
   the wall's, and a page that filled the window would cover both. */
.lightbox__page {
  position: absolute;
  inset: 48px 24px 48px;
  width: calc(100% - 48px);
  height: calc(100% - 96px);
  border: 0;
  background: var(--bg);
}
```

- [x] **Step 7: Open the probe page on the wall**

Run `npm run dev`, click the probe card. Expected: the page renders inside the
frame and reads "probe — JS ran", so scripts are running under the default
sandbox. Escape closes it; the arrows still page the pile, because they belong
to the wall's own listener and not the lightbox.

- [x] **Step 8: Commit**

```bash
git add src/Lightbox.tsx src/lightbox.css src/lightbox-sandbox.ts src/lightbox-sandbox.test.ts
git commit -m "run a page in the lightbox instead of drawing it"
```

---

### Task 5: Push one from the CLI

**Files:**
- Modify: `bin/slop`

- [x] **Step 1: Take the flag**

In the option loop, beside `--note`:

```sh
    --sandbox) sandbox="$2"; shift 2 ;;
```

Declare it with the others near the top:

```sh
sandbox=""
```

- [x] **Step 2: Write it into the sidecar**

In `write_sidecar`, add to the guard so a bare `--sandbox` still writes a file:

```sh
  [ -z "$dest_caption" ] && [ -z "$sha" ] && [ -z "$attention" ] && [ -z "$note" ] && [ -z "$sandbox" ] && return 0
```

and to the body, after the `note` line:

```sh
    [ -n "$sandbox" ] && printf ',"sandbox":"%s"' "$(json_escape "$sandbox")"
```

- [x] **Step 3: Say so in the usage block**

In the comment header at the top of the file, after the `--note` line:

```sh
#   slop --sandbox "allow-scripts allow-forms" PAGE.html
#                                what an HTML page may do in the lightbox.
#                                `none` removes the sandbox entirely. Whoever
#                                pushes the page decides this; the wall applies
#                                what it is told.
```

- [x] **Step 4: Push a page and check the sidecar**

```bash
bin/slop --sandbox "allow-scripts allow-forms" --caption "the probe page" /tmp/probe.html
cat ~/slop/inbox/slopboard/*.html.slop.json
```

Expected: JSON carrying `"caption"`, `"sandbox"` and the repo, and a card on the
wall whose lightbox frame carries that sandbox — check it in devtools on the
`<iframe>`.

- [x] **Step 5: Commit**

```bash
git add bin/slop
git commit -m "let a pushed page say what it is allowed to do"
```

---

### Task 6: Write it down — eyes only

No test judges this and none should try.

**Files:**
- Modify: `DESIGN.md`

- [x] **Step 1: Look at a wall with pages on it**

Push three or four real HTML artifacts of different shapes — a long report, a
short dashboard, something that animates. Answer:

- Is a shot of a page recognizable as *that* page at wall distance, or does
  every page card read the same? If the second, the shot's window size is the
  first thing to try.
- How much of a typical card is empty background, given the viewport capture?
- Does anything animate badly — a page whose first paint is a spinner?

- [x] **Step 2: Record the ingest contract**

Extend `DESIGN.md`'s ingest contract section with what a page is: the extensions
accepted, that the card is a viewport shot and not the document, that `/orig`
serves the source HTML, and that the sandbox is the pusher's declaration. Say
that a page's `w`/`h` are the shot's, not the document's — it is the one field
whose meaning differs between the two kinds.

- [x] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "record what a page artifact is"
```

---

## Open bug: the whole screen flickers while a page is open

Reported 2026-09-10. Opening an HTML artifact and leaving it open while
artifacts arrive flickers the entire window at once, page and surround
together, as if frames are being dropped. **Measured 2026-09-10, and the
compositing explanation did not survive it. Still unexplained, still unfixed.**

The suspected mechanism was blur cost: `.lightbox` is a fullscreen translucent
sheet, the canvas underneath redraws continuously, and `.topbar` and
`.sidebar` each carry `backdrop-filter: blur(6px)` above it, so every canvas
frame would invalidate a blur region over a changing translucent stack.

### What the measurement says

Six ten-second holds against a seeded wall with an artifact arriving every
second, at the side monitor's own backing store (3008×1692 at 2x), each
isolating one suspect. Run twice, agreeing both times:

| hold | dropped |
| --- | --- |
| lightbox closed | 0.1–2.6% |
| **page open** | **0.0–0.3%** |
| page open, no `backdrop-filter` | 0.0–0.9% |
| page open, opaque scrim | 0.0–0.9% |
| page open, iframe hidden | 0.0–2.2% |

**Opening a page is the calmest the wall gets, not the busiest** — it covers
the canvas, so there is less to composite. Removing `backdrop-filter` does not
help; in both runs it left drops flat or slightly worse. No frame in any hold
carried missing content or a checkerboarded tile, which is what a flicker
would have to be made of.

Then the symptom itself, rather than a suspect: every presented frame captured
and diffed against the one before it. With a page open, **1193 consecutive
frames over 12 seconds were identical** — the output does not change at all,
let alone flicker. With the lightbox closed the only global steps are cards
arriving, one frame of untextured box before the texture lands.

So the blur hypothesis is dead, and headless Chrome does not reproduce the bug
at any pixel budget. Both runs are re-runnable: `tools/flicker-matrix.mjs` and
`tools/flicker-screencast.mjs`, which document their own wall setup.

**The iframe is not reloading, now measured rather than read.** Pinned to the
one artifact that is known to trigger it, on a wall with nothing else to open,
15 seconds of arrivals produced **no request for `/orig/` and no frame
navigation** — and 1493 identical presented frames. The frame is not being
touched, and neither is the picture.

The artifact that triggers it is `wall/1670B20E…` ("Pinning a yellow"). It has
no script, no timer, no canvas, and no CSS animation, and its five siblings on
that zone come from the same generator with the same `color-scheme` — one of
them larger. Whatever singles it out is not visible in its source.

### What is left

Everything the harness could not hold: the real 120Hz display, a window the
macOS window server actually composites, Chrome's EDR handling on a monitor in
that mode, and a browser with the rest of a working day open in it.

Three observations would cut the field before anyone traces anything, and each
takes ten seconds at the wall:

- Does it still flicker with the window dragged to the built-in display?
- Does a dark page flicker as much as a bright one?
- Does an **image** lightbox flicker, or only a page?

A display-only answer to the first points at the monitor's refresh or its EDR
headroom rather than at anything in this repo. A yes to the third takes the
iframe out of it entirely.

The trace that would settle it has to come from the real window — DevTools →
Performance, ten seconds while it flickers, saved to JSON. `tools/flicker-report.mjs`
reads the same events out of one.

## Deliberately not in this plan

- **A card treatment that says "this is a page."** Every card is a picture and
  reads as one; nothing marks a page as different in the scene. Revisit once
  there are enough on the wall to want it.
- **Re-shooting.** The card is the page as it was when it landed. A page that
  fetches live data will be wrong the moment it is stale, and the wall has no
  way to know.
- **Directory bundles.** One file, one artifact. A folder needs a second notion
  of identity, since `idFor` is a source path and `/orig` is one `sendFile`.
- **PDFs, video, anything else.** `kindOf` is where they would go and the shape
  is the same — turn it into pixels once, then it is an image. Nothing here
  assumes the set stops at two.
