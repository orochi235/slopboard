# The params panel and the filter band, on weasel's controls

For whoever builds this. It says which `@weasel-js/ui` components replace the
wall's hand-rolled chrome, where the theme tokens live once two surfaces need
them, and which of the two bugs found on the way is fixed by construction
rather than by a CSS patch.

Not built yet.

## What is wrong today

**The params panel is native form controls in a hand-rolled grid.** A
`<input type="range">` with `accent-color`, a native `<select>`, a native
color input and a native checkbox, laid out by a three-column
`grid-template-columns: 132px 116px 52px`. It works. It does not look like the
wall, the checkboxes are whatever the OS draws, and the value column is ragged
— `0.305` sits above `420` sits above `1`, so a column meant to be compared
down has to be read across.

**The band's slider is 82px wide over a 520px histogram.** `.topbar__range`
stretches to its container with `position: absolute; inset: 0`, but
`display: flex` never stretches the React Aria track inside it, which takes its
natural width and centers. The thumbs do not point at the times they select.
Measured on the running wall, not inferred.

## What replaces them

`@weasel-js/ui` 1.4.1 is already a dependency; nothing new is installed.

### The token bridge, shared

Weasel's components are painted entirely by `--wzl-*` custom properties. With
those unset a control renders with correct geometry and fully transparent
paint, which looks like a component that failed to mount. The bridge that sets
them is written out in `src/topbar.css`, scoped to `.topbar__range`.

It moves to `src/weasel.css` as a `.wzl-skin` class, applied to
`.topbar__range` and to each `<details className="params__group">`. The token
values are the ones already there — the wall's own palette, not
`@weasel-js/theme`, whose tokens.css sets a document font and would re-type
every label in the scene.

Per group rather than one wrapper around `ParamsBody`, because `.prefs__body`
lays its children out in CSS multi-columns (`columns: 320px`, with
`.prefs__body > *` set to `break-inside: avoid`). A wrapper would become the
single column item and fold the modal to one column. Carrying the skin on the
groups leaves them the direct children they are today. The transfer row holds
no weasel components and needs no skin.

One deviation stays scoped to the band: `--wzl-surface-sunken` is translucent
there so the histogram shows through the track. The params panel wants a solid
track and takes the default.

`import '@weasel-js/ui/style.css'` moves from `TopBar.tsx` to the entry, since
it is no longer one component's business. Still the component styles only.

### The params panel

`ParamsBody` keeps its `<details>` groups. `PropertyGroup` has no collapsed
state, and nineteen groups open at once is not a panel. Inside each group,
`<PropertyList>` replaces `.params__grid`, and each control becomes the row
weasel already has for it:

| `Control` kind | Row |
|---|---|
| `slider` | `SliderRow` |
| `choice` | `SelectRow` |
| `color` | `ColorRow` |
| `toggle` | `CheckboxRow` |
| `number` | `NumberRow` |

All `layout="inline"` — label left, control right, readout right-aligned
beside the label. Weasel's default is `block`, which stacks the label above a
full-width track and roughly doubles the panel's height across nineteen
groups.

`step.z`'s `invert` is unchanged: negate on the way in, negate on the way out.
The reason it exists is in `params.controls.ts` and does not move.

`params.css` loses `.params__row`, `.params__name`, `.params__slider`,
`.params__value`, `.params__wide`, `.params__toggle` and `.params__color`. It
keeps the group, transfer, button, note and file rules, which are the panel's
own chrome rather than a control's. `sidebar.css` loses its
`.sidebar .params__row` column override, which has nothing left to widen.

`SelectRow` and `ToggleRow` are typed `<T extends string>`, and `choice`
options are `readonly (number | string)[]` — the numeric ones stringify at the
boundary and parse back exactly as the current `<select>` does.

### The readout

`SliderRow` takes a `format`. Two new pure functions in `params.controls.ts`:
`decimalsOf(step)` counts the decimals the step itself is written with, and
`formatStepped(value, step)` renders to that many places. Step `0.001` gives
three, step `1` gives none, and the trailing zeros are the point — every value
in a group then keeps its decimal point in the same place down the column, with
tabular figures.

The current `show()` sends anything at or above 1000 to exponential, which
turns `shoveMs` 3000 into `3.00e+3`. The threshold moves to 1e6, so the only
values that still go exponential are `lod.budgetBytes`, which genuinely has
nine digits.

This is the only new logic on the params side, and the only part of it worth a
test.

### The band

`RangeSlider` becomes `Slider` — the fully-controlled multi-thumb one — and the
histogram moves from a sibling `<svg>` into its `renderTrack`, which is handed
`{ trackWidth, valueToFraction }`.

```
<Slider
  thumbs={[{ value: from }, { value: to }]}
  min={span.from}
  max={span.to}
  constraint="ordered"
  trackClick="move-nearest"
  renderTrack={({ trackWidth, valueToFraction }) => …bars…}
/>
```

The width bug is not fixed so much as made unrepresentable: the bars and the
thumbs read the same track width from the same context, so they cannot drift
apart again. `trackClick: 'move-nearest'` makes a press on the shape send the
nearer edge there and carry on as a drag, which is what a person aims at a
histogram expects.

`onInput` fires through the drag and `onChange` once at its end; the wall wants
the live one, as it has now.

`spanOf`, `histogram` and `keptBy` in `src/nav/time-filter.ts` are untouched.
So are the named buckets, the scale labels and the count.

## What is deliberately not done

**`Timeline` is not the band's control.** It is a keyframe animation editor —
tracks, a playhead, dope and graph modes, easing handles. The handoff suggested
looking at it; the API does not survive contact with a time-range brush. Do not
re-propose it.

**`PropertyPanel` is not used.** It draws a titled glass card, and the sidebar
already supplies the panel around these rows.

## Verification

Every test in `src/` is pure logic under vitest with no DOM, and there is no
component-test harness to add one to. So the split is:

- **Unit**: the step-to-decimals formatter, beside the other `params.*` tests.
- **Screenshot**: both surfaces to the slopboard wall. The before shots are
  already on it, captured off the running wall with headless playwright —
  `.sidebar` with every `<details>` forced open, and `.topbar`. Take the after
  shots the same way and compare. The band's before shot is the one carrying
  the width bug.

Run only `src/params.*` and `src/nav/time-filter` while iterating.
