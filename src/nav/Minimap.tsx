import type { Rect } from 'windease'
import { unionOf } from '@/nav/zone-cells.ts'
import './minimap.css'

export type MinimapCell = { zone: string; box: Rect }

/**
 * The wall's plan view: one box per zone in its place on the wall, with the
 * focused one lit and every one a way to get there. Cells come from what is
 * drawn rather than the nominal grid, so a pile that has grown past its cell
 * reads as the wider box it is.
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
      <span className="minimap__label">{focus ?? 'wall'}</span>
    </div>
  )
}
