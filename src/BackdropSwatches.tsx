import { useMemo } from 'react'
import { BACKDROPS, type Backdrop } from '@shared/backdrops.ts'
import { swatches } from '@/textures/swatches.ts'
import './backdrop-swatches.css'

/** What `value` holds for a zone that has not chosen, which is not a backdrop
 *  and so cannot collide with one. */
export const INHERIT = ''

/**
 * The backdrops, shown rather than named.
 *
 * A dropdown asks which of nine words you want without telling you what any of
 * them look like, which for a pattern is the whole of the question — and the
 * names were provably not enough, since `diamonds` drew a grid for as long as
 * it was only ever read.
 */
export function BackdropSwatches({
  label,
  value,
  tint,
  /** What the inherit swatch stands in for. Omitted, no inherit tile is shown
   *  — the wall's own setting has nothing above it to fall back to. */
  inherits,
  onChange,
}: {
  label: string
  value: Backdrop | typeof INHERIT
  /** The color the pattern is drawn in, so a swatch matches its own cell. */
  tint: string
  inherits?: Backdrop
  onChange: (next: Backdrop | typeof INHERIT) => void
}) {
  // Once for the page, not once per sheet: two panels offer these and a sheet
  // is opened again and again, while the patterns never change.
  const masks = useMemo(() => swatches(), [])

  const tile = (key: Backdrop | typeof INHERIT, name: string, shows: Backdrop) => {
    const mask = masks[shows]
    return (
      <button
        key={key || 'inherit'}
        type="button"
        className="swatch"
        data-on={value === key ? '' : undefined}
        data-empty={shows === 'none' ? '' : undefined}
        data-inherit={key === INHERIT ? '' : undefined}
        aria-pressed={value === key}
        aria-label={name}
        title={name}
        onClick={() => onChange(key)}
      >
        {/* The pattern is worn by a face inside the button, not by the button.
            A mask clips hit testing in WebKit, so masking the control itself
            leaves only the drawn lines clickable — a hatch tile then has to be
            hit on one of five hairlines, and dots is barely pickable at all.
            The mask and the tint are per-tile and change with the zone, so
            they cannot be a class; everything else about a swatch is. */}
        <span
          className="swatch__face"
          style={
            mask
              ? { maskImage: `url(${mask})`, WebkitMaskImage: `url(${mask})`, background: tint }
              : undefined
          }
        />
      </button>
    )
  }

  return (
    <div className="swatches" role="group" aria-label={label}>
      <span className="swatches__label">{label}</span>
      <div className="swatches__grid">
        {inherits !== undefined && tile(INHERIT, `the wall's (${inherits})`, inherits)}
        {BACKDROPS.map((backdrop) => tile(backdrop, backdrop, backdrop))}
      </div>
    </div>
  )
}
