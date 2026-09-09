# Weasel Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: done.** Tasks 1-7 landed on `main` on 2026-09-09, ending at `8e7c804`.
Kept for the reasoning in its task notes, not as work outstanding.

**Goal:** Replace the params panel's native form controls with `@weasel-js/ui`'s property rows, and the filter band's misaligned `RangeSlider` with a `Slider` that paints the histogram inside its own track.

**Architecture:** The `--wzl-*` token bridge moves out of `src/topbar.css` into a shared `src/weasel.css`, worn by each params group and by the band's slider. `ParamsBody`'s five `Control` kinds map one-to-one onto `SliderRow`/`SelectRow`/`ColorRow`/`CheckboxRow`/`NumberRow`, deleting the hand-rolled three-column grid. The band's histogram moves from a sibling `<svg>` into `Slider`'s `renderTrack`, so the bars and the thumbs read one track width.

**Tech Stack:** React 19, TypeScript, Vite, vitest (node environment, no DOM), `@weasel-js/ui` 1.4.1 (already a dependency).

**Spec:** `docs/superpowers/specs/2026-09-08-weasel-controls-design.md`

---

## File Structure

**Created:**
- `src/weasel.css` — the `--wzl-*` bridge as a `.wzl-skin` class, one place, both surfaces.

**Modified:**
- `src/params.controls.ts` — gains `decimalsOf` and `formatStepped`; the control model is otherwise untouched.
- `src/params.controls.test.ts` — tests for the two new functions.
- `src/Params.tsx` — `ParamsBody`'s rows become weasel property rows; `show()` is deleted.
- `src/params.css` — control rules deleted, panel chrome kept.
- `src/sidebar.css` — the `.sidebar .params__row` override deleted.
- `src/TopBar.tsx` — `RangeSlider` → `Slider`, histogram into `renderTrack`, style import removed.
- `src/topbar.css` — bridge block removed, `.topbar__range`/`.topbar__chart` rules reduced.
- `src/main.tsx` — `@weasel-js/ui/style.css` imported once, here.

**Untouched, deliberately:** `src/nav/time-filter.ts`, `src/params.groups.ts`, `src/params.paths.ts`, `src/params.store.ts`, `src/Sidebar.tsx`, `src/Prefs.tsx`.

## Before you start

The wall runs under launchd on ports 8787 (daemon) and 5183 (client). Check it is up:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5183/
```

`200` means the client is live and Vite will hot-reload your edits. Anything else: `~/src/slopboard/bin/wall cycle`.

**Test scope.** Run only what you changed. Every test in this repo is pure logic under vitest with a node environment — there is no DOM harness, so nothing in this plan is covered by a component test. The visual half is verified by screenshot.

```bash
npx vitest run src/params.controls.test.ts
```

Do not run the full suite until Task 7.

---

### Task 1: The readout formatter

The params panel's value column is ragged today — `0.305` sits above `420` sits above `1`. Decimal places come from the control's own step so the column keeps its point in one place.

**Files:**
- Modify: `src/params.controls.ts`
- Test: `src/params.controls.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/params.controls.test.ts`:

```ts
describe('decimalsOf', () => {
  it('counts the decimals the step is written with', () => {
    expect(decimalsOf(0.001)).toBe(3)
    expect(decimalsOf(0.005)).toBe(3)
    expect(decimalsOf(0.0002)).toBe(4)
    expect(decimalsOf(0.5)).toBe(1)
  })

  it('gives a whole step none', () => {
    expect(decimalsOf(1)).toBe(0)
    expect(decimalsOf(10)).toBe(0)
    expect(decimalsOf(16 * 1024 * 1024)).toBe(0)
  })
})

describe('formatStepped', () => {
  it('holds the trailing zeros, so a column keeps its point in one place', () => {
    expect(formatStepped(0.3, 0.005)).toBe('0.300')
    expect(formatStepped(1, 0.01)).toBe('1.00')
  })

  it('keeps a whole-stepped value whole', () => {
    expect(formatStepped(420, 10)).toBe('420')
    expect(formatStepped(22, 1)).toBe('22')
  })

  it('carries the sign', () => {
    expect(formatStepped(-0.013, 0.001)).toBe('-0.013')
  })

  // The old show() sent everything past 1000 to exponential, which made
  // shoveMs read 3.00e+3. Only budgetBytes is genuinely too wide.
  it('goes exponential only past a million', () => {
    expect(formatStepped(3000, 10)).toBe('3000')
    expect(formatStepped(268435456, 16 * 1024 * 1024)).toBe('2.68e+8')
  })
})
```

Add the two names to the file's existing import from `@/params.controls.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/params.controls.test.ts`
Expected: FAIL — `decimalsOf is not a function` / `formatStepped is not a function`, or a TypeScript error that neither is exported.

- [ ] **Step 3: Implement**

Add to `src/params.controls.ts`, below the `Control` type:

```ts
/** How many decimals `step` is written with. `0.005` is three, `10` is none. */
export function decimalsOf(step: number): number {
  const text = String(step)
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

/** A slider's readout, to its step's precision — trailing zeros included, so
 *  the column is read down rather than across. Only a value too wide for the
 *  column goes exponential. */
export function formatStepped(value: number, step: number): string {
  return Math.abs(value) >= 1e6 ? value.toExponential(2) : value.toFixed(decimalsOf(step))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/params.controls.test.ts`
Expected: PASS, including the file's existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/params.controls.ts src/params.controls.test.ts
git commit -m "read a slider's precision off its own step"
```

---

### Task 2: The shared token bridge

Weasel's components are painted entirely by `--wzl-*` custom properties. Unset, a control renders with correct geometry and fully transparent paint, which looks like a component that failed to mount. The bridge exists in `src/topbar.css` scoped to `.topbar__range`; two surfaces need it now.

**Files:**
- Create: `src/weasel.css`
- Modify: `src/topbar.css:116-143`
- Modify: `src/main.tsx`
- Modify: `src/TopBar.tsx:1-5`

No test — this is CSS, verified by screenshot in Task 6.

- [ ] **Step 1: Create the bridge file**

Create `src/weasel.css`:

```css
/*
 * The tokens weasel's controls read, mapped onto the wall's own palette.
 * Written out here rather than by importing `@weasel-js/theme` — its
 * tokens.css also sets a document font and would re-type the whole wall.
 * Worn by each element that holds weasel components, never by the document,
 * so nothing here reaches the rest of the chrome.
 */
.wzl-skin {
  --wzl-accent: var(--accent);
  --wzl-accent-strong: color-mix(in srgb, var(--accent) 80%, white);
  --wzl-fg: var(--ink);
  --wzl-fg-muted: var(--muted);
  --wzl-fg-inverse: var(--bg);
  --wzl-fg-on-accent: var(--bg);
  --wzl-surface-sunken: color-mix(in srgb, var(--ink) 22%, transparent);
  --wzl-border: color-mix(in srgb, var(--muted) 40%, transparent);
  --wzl-border-strong: var(--muted);
  --wzl-slider-thumb-tint: var(--accent);
  --wzl-focus-ring: var(--accent);
  --wzl-radius-sm: 2px;
  --wzl-radius-pill: 999px;
  --wzl-motion-fast: 120ms;
  --wzl-font-ui: inherit;
}
```

**This block is wrong and shipped corrected — see `src/weasel.css` for what is
actually there.** `--wzl-slider-thumb-tint` is a *percentage* consumed inside a
`color-mix` against `--wzl-accent`, not a color, so the value above silently
unpaints the thumb. It also misses `--wzl-slider-track-tint`,
`--wzl-slider-track-h` and `--wzl-slider-thumb-size`, the last two of which have
no fallback in weasel's CSS and so collapse the track to no height.

- [ ] **Step 2: Import it once, at the entry**

In `src/main.tsx`, add both imports below the existing `import '@/styles.css'`:

```ts
import '@weasel-js/ui/style.css'
import '@/weasel.css'
```

The weasel stylesheet is the component styles only — deliberately not `@weasel-js/theme`'s tokens.css.

- [ ] **Step 3: Drop the moved block from topbar.css**

In `src/topbar.css`, replace the whole `.topbar__range { … }` rule — the comment above it and every `--wzl-*` line inside it — with:

```css
/* The track is the histogram: `renderTrack` draws the bars inside it, so the
   bars and the thumbs cannot land on different widths. */
.topbar__range {
  --wzl-surface-sunken: transparent;
}
```

Translucent here and only here: the histogram is what is being selected, and a solid track would hide the shape you are aiming at.

- [ ] **Step 4: Drop the stylesheet import from TopBar**

In `src/TopBar.tsx`, delete lines 3–5 — the two-line comment and `import '@weasel-js/ui/style.css'`. It is the entry's business now.

- [ ] **Step 5: Verify the app still builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Then reload `http://localhost:5183/` and confirm the band's slider still renders with cyan paint rather than transparent. Paint is the only thing this step is checking.

The band will look worse than it did, and that is expected: dropping the old rule takes `position: absolute; inset: 0` with it, so the slider falls out from over the histogram and sits below it. It stays that way until Task 5 removes the overlay arrangement entirely. Do not patch it back — the positioning is what Task 5 deletes.

- [ ] **Step 6: Commit**

```bash
git add src/weasel.css src/main.tsx src/topbar.css src/TopBar.tsx
git commit -m "lift the weasel token bridge out of the band"
```

---

### Task 3: The params rows

`ParamsBody`'s five control kinds each have a weasel row already. The `<details>` groups stay — `PropertyGroup` has no collapsed state, and nineteen open groups is not a panel.

**Files:**
- Modify: `src/Params.tsx:1-10, 101-201`

- [ ] **Step 1: Swap the imports**

At the top of `src/Params.tsx`, replace the `show` helper (lines 9–10) and add the weasel import. The head of the file becomes:

```tsx
import { useRef, useState } from 'react'
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  SelectRow,
  SliderRow,
} from '@weasel-js/ui'
import { controlsOf, formatStepped } from '@/params.controls.ts'
import { groupControls } from '@/params.groups.ts'
import { leafAt, setAt } from '@/params.paths.ts'
import { defaultParams, type StackParams } from '@/params.ts'
import { fromText, toText } from '@/params.transfer.ts'
import './params.css'
```

`show` is gone; `formatStepped` replaces it. `Transfer` is unchanged — its buttons are the panel's own chrome, not weasel controls.

- [ ] **Step 2: Rewrite the group body**

Replace everything from `return (` in `ParamsBody` (line 112) to the end of the file with:

```tsx
  return (
    <>
      <Transfer params={params} onChange={onChange} />
      {groupControls(controlsOf(params)).map((group) => (
        <details
          className="params__group wzl-skin"
          key={group.name}
          open={expanded || group.name === 'wall'}
        >
          <summary className="params__groupName">{group.name}</summary>
          <PropertyList>
            {group.controls.map((control) => {
              const value = leafAt(params, control.path) ?? 0
              const set = (next: number | string | boolean) =>
                onChange(setAt(params, control.path, next))
              const label = control.path.startsWith(`${group.name}.`)
                ? control.path.slice(group.name.length + 1)
                : control.path

              switch (control.kind) {
                case 'slider': {
                  // Stored negative, read as a magnitude — see INVERTED in
                  // params.controls.ts. The sign never reaches the control.
                  const shown = control.invert ? -(value as number) : (value as number)
                  return (
                    <SliderRow
                      key={control.path}
                      label={label}
                      layout="inline"
                      value={shown}
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      format={(v) => formatStepped(v, control.step)}
                      onChange={(next) => set(control.invert ? -next : next)}
                    />
                  )
                }
                case 'choice':
                  return (
                    <SelectRow
                      key={control.path}
                      label={label}
                      layout="inline"
                      value={String(value)}
                      options={control.options.map((option) => ({
                        value: String(option),
                        label: String(option),
                      }))}
                      onChange={(raw) => {
                        const n = Number(raw)
                        set(raw !== '' && Number.isFinite(n) ? n : raw)
                      }}
                    />
                  )
                case 'color':
                  return (
                    <ColorRow
                      key={control.path}
                      label={label}
                      value={String(value)}
                      onChange={set}
                    />
                  )
                case 'toggle':
                  return (
                    <CheckboxRow
                      key={control.path}
                      label={label}
                      value={value === true}
                      onChange={set}
                    />
                  )
                case 'number':
                  return (
                    <NumberRow
                      key={control.path}
                      label={label}
                      layout="inline"
                      value={value as number}
                      onChange={(next) => {
                        if (Number.isFinite(next)) set(next)
                      }}
                    />
                  )
              }
            })}
          </PropertyList>
        </details>
      ))}
    </>
  )
}
```

Three things to keep straight:

`layout="inline"` on every row that takes it. Weasel's default is `block`, which stacks the label above a full-width track and roughly doubles the panel's height across nineteen groups. `ColorRow` and `CheckboxRow` take no `layout` — they are inline by their own nature.

`SelectRow` is typed `<T extends string>` and `control.options` is `readonly (number | string)[]`, so the options stringify going in and the numeric ones parse back on the way out — exactly what the native `<select>` did.

The `switch` is exhaustive over `Control['kind']`, so a sixth kind added later is a type error here rather than a row that silently renders nothing.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

If `SliderRow`'s `format` complains, its signature is `(value: number) => ReactNode` — the arrow above already matches; check you did not pass `formatStepped` bare.

- [ ] **Step 4: Look at it**

Reload `http://localhost:5183/`, click the `‹` tab at the right edge to open the sidebar, and scroll to PARAMS. Every row should be label-left / control-right, painted in the wall's cyan, with the readout right-aligned beside the label and its decimals steady down each group.

- [ ] **Step 5: Commit**

```bash
git add src/Params.tsx
git commit -m "put the params panel on weasel's property rows"
```

---

### Task 4: Delete the grid the rows replaced

**Files:**
- Modify: `src/params.css`
- Modify: `src/sidebar.css:192-196`

- [ ] **Step 1: Cut the control rules from params.css**

Delete these rules entirely: `.params__row`, `.params__name`, `.params__slider`, `.params__value`, `.params__wide` (with its comment), `.params__toggle`, `.params__color`.

Also delete `.params__grid` — `<PropertyList>` supplies the grid now.

Keep: `.params__group`, `.params__groupName`, `.params__groupName:hover`, `.params__transfer`, `.params__button`, `.params__button:hover`, `.params__note`, `.params__file`. Those are the panel's own chrome.

- [ ] **Step 2: Cut the sidebar override**

In `src/sidebar.css`, delete the two-line comment beginning "The params controls came from a narrower corner panel" and the `.sidebar .params__row` rule beneath it. There is no `.params__row` left to widen.

Leave `.sidebar__buttons .params__button:disabled` — `.params__button` survives.

- [ ] **Step 3: Verify nothing still references a deleted class**

Run:

```bash
grep -rn "params__row\|params__name\|params__slider\|params__value\|params__wide\|params__toggle\|params__color\|params__grid" src/
```

Expected: no output. Any hit is a class you deleted the rule for but left in the JSX.

- [ ] **Step 4: Look at it again**

Reload and re-open the sidebar. The rows should look the same as they did at the end of Task 3 — you removed rules that no element wears. If anything shifted, a deleted rule was still doing work and belongs back.

- [ ] **Step 5: Commit**

```bash
git add src/params.css src/sidebar.css
git commit -m "drop the params grid the property rows replaced"
```

---

### Task 5: The band's histogram moves inside the track

The band's track is 82px wide against a 520px histogram, so the thumbs do not point at the times they select. The cause is one property of ours: weasel's `.slider` is already a column flex container, and `.topbar__range` adds `align-items: center`, which in a column container governs the horizontal axis — the track shrinks to fit and lands on its `min-width: 80px`. The rework here removes that wrapper entirely, so the property goes with it.

Doing the rework rather than the one-line `align-items: stretch`: `Slider`'s `renderTrack` is handed `{ trackWidth, valueToFraction }`, so drawing the bars inside the track puts them on its own width by construction, and no future rule on a wrapper can separate them again.

**Files:**
- Modify: `src/TopBar.tsx:1-10, 43-99`
- Modify: `src/topbar.css:60-83`

- [ ] **Step 1: Swap the import**

In `src/TopBar.tsx` line 2, `RangeSlider` becomes `Slider`:

```tsx
import { Slider } from '@weasel-js/ui'
```

- [ ] **Step 2: Replace the chart block**

Replace the whole `<div className="topbar__chart">…</div>` block (lines 58–94, the `<svg>` and the `<RangeSlider>` together) with:

```tsx
        <div className="topbar__chart">
          <Slider
            className="topbar__range"
            thumbs={[{ value: value[0] }, { value: value[1] }]}
            min={span.from}
            max={span.to}
            step={Math.max(1000, Math.round((span.to - span.from) / 400))}
            constraint="ordered"
            trackClick="move-nearest"
            trackHeight={34}
            readoutPlacement="none"
            ariaLabel="Time range"
            onInput={(next) => onRange({ from: next[0].value, to: next[1].value })}
            renderTrack={({ valueToFraction }) => (
              // The shape of the day, so a burst is something you can see
              // before you go looking for it.
              <svg
                className="topbar__hist"
                viewBox={`0 0 ${BINS} 100`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {bins.map((n, i) => {
                  const start = span.from + ((span.to - span.from) * i) / BINS
                  const inside = !range || (start >= range.from && start <= range.to)
                  return (
                    <rect
                      key={i}
                      className={`topbar__bar ${inside ? '' : 'topbar__bar--out'}`}
                      x={i}
                      y={100 - (n / tallest) * 100}
                      width={0.86}
                      height={(n / tallest) * 100}
                    />
                  )
                })}
              </svg>
            )}
          />
        </div>
```

`onInput` fires through the drag, which is the live update the wall wants; `onChange` fires once at the end and is not wired, because there is no history to write to.

The `viewBox` plus `preserveAspectRatio="none"` means the SVG scales to whatever box CSS gives it, so `trackWidth` is not read here — `valueToFraction` is in scope for a later mark (a bucket edge, say) without another signature change.

- [ ] **Step 3: Reduce the chart CSS**

In `src/topbar.css`, replace the `.topbar__chart` and `.topbar__hist` rules with:

```css
.topbar__chart {
  margin-top: 4px;
}

.topbar__hist {
  display: block;
  width: 100%;
  height: 100%;
}
```

`position: relative` goes with the absolute positioning it existed for. The SVG now fills the track rather than the block, so its height is `100%` of a track that Task 2's `trackHeight={34}` sizes.

`.topbar__bar` and `.topbar__bar--out` are unchanged.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

`Slider` is generic over `T extends Thumb`; the inline `[{ value }, { value }]` array infers `Thumb` and needs no annotation.

- [ ] **Step 5: Measure that the bug is gone**

The band is at the top of the wall with no interaction needed. In the browser console at `http://localhost:5183/`:

```js
const chart = document.querySelector('.topbar__chart').getBoundingClientRect()
const track = document.querySelector('.topbar__range [class*="track"]').getBoundingClientRect()
console.log(Math.round(chart.width), Math.round(track.width))
```

Expected: two numbers within a few px of each other. Before this task they were 520 and 82.

- [ ] **Step 6: Drag it**

Drag each thumb. The bars outside the range should dim as the thumb passes them, and the count in the head (`218/218`) should fall. Click bare track away from both thumbs: the nearer one should jump there and keep dragging.

- [ ] **Step 7: Commit**

```bash
git add src/TopBar.tsx src/topbar.css
git commit -m "paint the band's histogram inside the slider's own track"
```

---

### Task 6: Screenshot both surfaces to the wall

The before shots are already on the slopboard wall. Take the after shots the same way and put them beside them.

**Files:** none — this is verification.

- [ ] **Step 1: Capture the params panel**

With headless playwright against `http://localhost:5183/` at a 1600×1000 viewport: click `.sidebar__tab` to open the sidebar, force every group open, then screenshot the `.sidebar` element.

```js
await page.setViewportSize({ width: 1600, height: 1000 })
await page.goto('http://localhost:5183/')
await page.locator('.sidebar__tab').click()
await page.evaluate(() => document.querySelectorAll('.params__group').forEach((g) => (g.open = true)))
await page.locator('.sidebar').screenshot({ path: 'params-after.png', scale: 'device' })
await page.locator('.topbar').screenshot({ path: 'band-after.png', scale: 'device' })
```

Write them to the session scratchpad, not the repo — a checked-in screenshot rots.

- [ ] **Step 2: Put them on the wall**

```bash
~/src/slopboard/bin/slop <scratchpad>/params-after.png <scratchpad>/band-after.png
```

- [ ] **Step 3: Compare**

Against the before shots already on the wall. Three things to check by eye:

The value column's decimal points line up down each group, and `shoveMs` reads `420` rather than `4.20e+2`.

The checkboxes and the `combine` select are cyan, not OS blue.

The band's thumbs sit at the ends of the histogram when no range is set, and the track spans the whole block.

- [ ] **Step 4: No commit**

Nothing changed on disk. If a comparison fails, the fix belongs in whichever of Tasks 3–5 owns it.

---

### Task 7: Pre-push gate

**Files:** none.

- [ ] **Step 1: Check nobody else is running the suite**

```bash
ps aux | grep -c "[v]itest"
```

Expected: `0`. Vitest takes nearly every core — a second concurrent run manufactures timeouts in files nobody touched.

- [ ] **Step 2: Run the full suite, once**

Run: `npm test`
Expected: green.

A failure in a file this plan did not touch is contention, not a regression. Say so and hand over the diff — do not re-run for a nicer number.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Then invoke the `prepare-js-commit` skill before the final commit, which is what this repo uses to catch lint and format drift that CI would otherwise find.

- [ ] **Step 4: Update the handoff**

In `docs/superpowers/plans/HANDOFF.md`, the outstanding list's head item — "The params panel's sliders are hand-rolled and bad" — is done. Delete it and record what landed in the "Since then, still on `main`" run of the Done section, including the two findings the spec names: the band's 82px track, and that `Timeline` is a keyframe editor and not a range brush.

`ParamsBody` is no longer "a hand-rolled property panel" either — delete that entry from the "Independent of all of the above" list.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/HANDOFF.md
git commit -m "record the weasel control swap"
```

---

## Self-review

Checked against `docs/superpowers/specs/2026-09-08-weasel-controls-design.md`:

- Bridge moved to `src/weasel.css` as `.wzl-skin`, per group and on `.topbar__range` — Tasks 2 and 3.
- Band's `--wzl-surface-sunken` deviation kept scoped — Task 2 Step 3.
- `style.css` moved to the entry — Task 2 Step 2.
- `<details>` groups kept, `PropertyList` inside — Task 3 Step 2.
- All five kind-to-row mappings, all `layout="inline"` — Task 3 Step 2.
- `step.z`'s `invert` preserved both directions — Task 3 Step 2.
- `params.css` and `sidebar.css` cuts — Task 4.
- `decimalsOf` / `formatStepped`, 1e6 threshold — Task 1.
- `Slider` + `renderTrack`, `constraint="ordered"`, `trackClick="move-nearest"` — Task 5.
- `time-filter.ts` untouched — no task modifies it.
- Unit test on the formatter, screenshots for the rest — Tasks 1 and 6.
- `PropertyPanel` and `Timeline` unused — no task imports either.
