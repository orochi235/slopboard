import { useEffect, useRef, useState } from 'react'
import { PropertyRow, Slider } from '@weasel-js/ui'
import type { Backdrop } from '@shared/backdrops.ts'
import { TWO_AXIS } from '@/zone-settings.ts'
import './backdrop-ruling.css'

/**
 * How a backdrop is ruled, once its pattern is picked: how close together, how
 * long a repeat runs where the pattern has a second axis, and what it is
 * turned to.
 *
 * Paired with the swatches rather than left in the parameter list, because the
 * pattern and how it is ruled are one decision — a pattern set at the wrong
 * pitch or the wrong angle reads as the wrong pattern.
 */

/** The pitches the wall will rule at. The daemon holds the same pair; a value
 *  outside them is refused there rather than stored. */
export const PITCH = { min: 0.002, max: 0.1 } as const

/** Density runs the other way from pitch and over five doublings, so the
 *  travel is logarithmic: an even drag reads as an even change in how busy the
 *  cell looks, which a linear pitch does not. */
const densityOf = (spacing: number) =>
  Math.log(PITCH.max / spacing) / Math.log(PITCH.max / PITCH.min)

const spacingOf = (density: number) => PITCH.max * Math.pow(PITCH.min / PITCH.max, density)

/** Padded to the width of the widest reading it can hold, so what sits beside
 *  the readout does not step sideways every time the thumb moves. */
const pad = (n: number, width: number) => String(Math.round(n)).padStart(width, ' ')

/** How often a drag is allowed to write. The zone sheet's rows go to the
 *  daemon, which stores them in a file; a write per frame is sixty a second. */
const WRITE_MS = 120

type Field = 'spacing' | 'period' | 'angle'
type Patch = Partial<Record<Field, number | null>>

export function BackdropRuling({
  /** The pattern actually in force, which decides whether the second axis has
   *  anything to say. */
  backdrop,
  /** What this level sets, each null where it takes the one above. */
  own,
  /** What null means here — the wall's, or for the wall itself its own. */
  wall,
  /** Whether there is anything above this to fall back to. */
  inherits = false,
  onChange,
}: {
  backdrop: Backdrop
  own: Record<Field, number | null>
  wall: Record<Field, number>
  inherits?: boolean
  onChange: (patch: Patch) => void
}) {
  /**
   * What the thumb reads while a drag is in flight.
   *
   * The zone sheet's rows are not local state: they go to the daemon and come
   * back over the socket, so a thumb bound straight to the prop sits on the
   * old value for as long as the round trip takes and springs back under the
   * pointer. This holds the dragged value until the answer catches up with it.
   */
  const [live, setLive] = useState<Partial<Record<Field, number>>>({})
  /** The last value written, so the hold can tell the answer to its own write
   *  from a change made somewhere else — another tab, or the wall's default
   *  moving under a zone that inherits. */
  const sent = useRef<Partial<Record<Field, number>>>({})
  const wrote = useRef<Partial<Record<Field, number>>>({})

  const settled = (Object.keys(live) as Field[]).filter(
    (f) => (own[f] ?? wall[f]) === sent.current[f],
  )
  useEffect(() => {
    if (settled.length === 0) return
    setLive((held) => {
      const next = { ...held }
      for (const f of settled) delete next[f]
      return next
    })
    // The filter is recomputed every render from props; listing it would run
    // this on every one of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled.join()])

  const put = (f: Field, value: number, commit: boolean) => {
    setLive((held) => ({ ...held, [f]: value }))
    sent.current[f] = value
    const last = wrote.current[f]
    if (!commit && last !== undefined && Date.now() - last < WRITE_MS) return
    wrote.current[f] = Date.now()
    onChange({ [f]: value })
  }

  const row = (
    field: Field,
    label: string,
    range: { min: number; max: number; step: number },
    toSlider: (stored: number) => number,
    toStored: (slid: number) => number,
    readout: (stored: number) => string,
  ) => {
    const stored = live[field] ?? own[field] ?? wall[field]
    return (
      <PropertyRow key={field} label={label} layout="inline">
        <Slider
          className="ruling__slider"
          thumbs={[{ value: toSlider(stored) }]}
          min={range.min}
          max={range.max}
          step={range.step}
          density="slim"
          // A press on the bar sends the thumb there and carries on as a drag.
          // Off in the kit because a stray press on a multi-thumb editor would
          // yank a stop nobody aimed at; every slider here has one thumb.
          trackClick="move-nearest"
          readoutPlacement="inline-after"
          renderReadout={() => <span className="ruling__readout">{readout(stored)}</span>}
          ariaLabel={label}
          onInput={(next) => {
            const v = next[0]?.value
            if (v !== undefined) put(field, toStored(v), false)
          }}
          onChange={(next) => {
            const v = next[0]?.value
            if (v !== undefined) put(field, toStored(v), true)
          }}
        />
        {inherits && (
          <button
            type="button"
            className="ruling__wall"
            // Pressed while this row is taking the wall's, so the control says
            // which of its two states it is in rather than only offering one.
            aria-pressed={own[field] === null}
            disabled={own[field] === null}
            title={`back to the wall's ${label}`}
            onClick={() => {
              setLive((held) => {
                const next = { ...held }
                delete next[field]
                return next
              })
              delete sent.current[field]
              onChange({ [field]: null })
            }}
          >
            wall
          </button>
        )}
      </PropertyRow>
    )
  }

  const asDensity = { min: 0, max: 1, step: 0.01 }
  const readDensity = (stored: number) => pad(densityOf(stored) * 100, 3)

  return (
    <>
      {row('spacing', 'density', asDensity, densityOf, spacingOf, readDensity)}
      {/* Only where the pattern is built on two axes. A chevron is read by the
          angle between its arms, which is the ratio of the two pitches; every
          other pattern is ruled at one and a second slider would move
          nothing. */}
      {TWO_AXIS.has(backdrop) &&
        row('period', 'repeat', asDensity, densityOf, spacingOf, readDensity)}
      {row(
        'angle',
        'rotation',
        { min: 0, max: 360, step: 1 },
        (a) => a,
        (a) => a,
        (a) => `${pad(a, 3)}°`,
      )}
    </>
  )
}
