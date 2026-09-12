import type { Rect } from 'windease'
import { unionOf } from '@/nav/zone-cells.ts'
import './minimap.css'

export type MinimapCell = { zone: string; box: Rect }

/** What the plan draws. */
export type Plan = { cells: MinimapCell[] }

/**
 * The wall's plan view: one icon per zone in its place on the wall, with the
 * focused one lit and every one a way to get there. An icon is the pile's base
 * card, not the union of what it has drawn — a pile's deep ranks step past its
 * own cell, and sizing icons by that makes a tall pile read as a zone that has
 * taken more of the wall than its neighbour.
 */
export function Minimap({
  cells,
  focus,
  onFocus,
}: {
  cells: MinimapCell[]
  focus: string | null
  onFocus: (zone: string) => void
}) {
  // The icons' own extent. A pile steps back and to the left as it deepens, so
  // framing everything drawn leaves the plan sitting in a margin of the sprawl
  // nobody reads off a box this size.
  const bounds = unionOf(cells.map((c) => c.box))
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null

  return (
    <div className="minimap">
      <svg
        className="minimap__svg"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="wall plan"
      >
        {cells.map(({ zone, box }) => (
          <rect
            key={zone}
            className={`minimap__cell ${zone === focus ? 'minimap__cell--focus' : ''}`}
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            // Hairlines in a viewBox this small have to be sized in its units.
            strokeWidth={bounds.h / 160}
            role="button"
            tabIndex={0}
            aria-label={zone}
            aria-pressed={zone === focus}
            onClick={() => onFocus(zone)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onFocus(zone)
            }}
          />
        ))}
      </svg>
    </div>
  )
}
