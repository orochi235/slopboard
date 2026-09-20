import { PropertyRow, Slider } from '@weasel-js/ui'
import './backdrop-density.css'

/**
 * How close together a backdrop is ruled, offered as a density rather than as
 * the pitch it actually sets. Two controls in one row: the slider, and a tile
 * that puts a zone back to the wall's.
 *
 * Paired with the swatches rather than left in the parameter list, because the
 * pattern and how tightly it is drawn are one decision — a pattern picked at
 * the wrong pitch reads as the wrong pattern.
 */

/** The pitches the wall will rule at. The daemon holds the same pair; a value
 *  outside them is refused there rather than stored. */
export const PITCH = { min: 0.002, max: 0.1 } as const

/** Density runs the other way from pitch and over three doublings, so the
 *  travel is logarithmic: an even drag reads as an even change in how busy the
 *  cell looks, which a linear pitch does not. */
const densityOf = (spacing: number) =>
  Math.log(PITCH.max / spacing) / Math.log(PITCH.max / PITCH.min)

const spacingOf = (density: number) =>
  PITCH.max * Math.pow(PITCH.min / PITCH.max, density)

export function BackdropDensity({
  /** The zone's own pitch, or null where it takes the wall's. */
  value,
  /** What null means here — the wall's pitch, or for the wall itself its own. */
  wall,
  /** Whether there is anything above this to fall back to. */
  inherits = false,
  onChange,
}: {
  value: number | null
  wall: number
  inherits?: boolean
  onChange: (next: number | null) => void
}) {
  const spacing = value ?? wall
  const own = value !== null
  return (
    <PropertyRow label="density" layout="inline">
      <Slider
        className="density__slider"
        thumbs={[{ value: densityOf(spacing) }]}
        min={0}
        max={1}
        step={0.01}
        density="slim"
        readoutPlacement="inline-after"
        // Padded to the width of the widest reading it can hold, so the row
        // beside it does not shift every time the thumb moves.
        renderReadout={(thumb) => (
          <span className="density__readout">{String(Math.round(thumb.value * 100)).padStart(3, ' ')}</span>
        )}
        ariaLabel="density"
        onInput={(next) => {
          const d = next[0]?.value
          if (d !== undefined) onChange(spacingOf(d))
        }}
      />
      {inherits && (
        <button
          type="button"
          className="density__wall"
          // Pressed while the zone is taking the wall's, so the control says
          // which of the two states it is in rather than only offering one.
          aria-pressed={!own}
          disabled={!own}
          title="back to the wall's density"
          onClick={() => onChange(null)}
        >
          wall
        </button>
      )}
    </PropertyRow>
  )
}
