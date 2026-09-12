import type { CSSProperties } from 'react'
import type { Rect } from 'windease'
import type { StackParams } from '@/params.ts'
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
 * taken more of the wall than its neighbor.
 *
 * An icon wears its zone's own ground: the project color the wall gives that
 * pile, hatched the way the wall hatches it. A plan drawn in one flat tint
 * makes the reader match icons to piles by position alone.
 */
export function Minimap({
  cells,
  focus,
  tints,
  zones,
  onFocus,
}: {
  cells: MinimapCell[]
  focus: string | null
  /** Each zone's lifted project color, where it has one. */
  tints: ReadonlyMap<string, string>
  /** The wall's own backdrop settings, so the two cannot disagree. */
  zones: StackParams['zones']
  onFocus: (zone: string) => void
}) {
  // The icons' own extent. A pile steps back and to the left as it deepens, so
  // framing everything drawn leaves the plan sitting in a margin of the sprawl
  // nobody reads off a box this size.
  const bounds = unionOf(cells.map((c) => c.box))
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null

  const grounded = zones.huedBackdrop && zones.backdrop !== 'none'
  const hatched = grounded && zones.backdrop === 'hatch'
  // The plan is an icon, not a scale drawing. The wall's spacing is in these
  // same units, and at the size of this box it would lay down a hundred and
  // fifty lines — a flat tint with a cost. The angle is the wall's; the pitch
  // is whatever reads here.
  const pitch = bounds.h / 9

  // Indexed rather than named: a zone is a directory name, and a URL reference
  // cannot carry everything one of those is allowed to hold.
  const ids = new Map([...tints.keys()].map((zone, i) => [zone, `slop-hatch-${i}`]))

  return (
    <div className="minimap">
      <svg
        className="minimap__svg"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="wall plan"
      >
        {hatched && (
          <defs>
            {[...tints].map(([zone, tint]) => (
              <pattern
                key={zone}
                id={ids.get(zone)}
                patternUnits="userSpaceOnUse"
                width={pitch}
                height={pitch}
                patternTransform={`rotate(${zones.hatchAngleDeg})`}
              >
                {/* The zone's ground, then its hatch over it: one fill has to
                    carry both, and a pattern is the only fill that can. */}
                <rect x={0} y={0} width={pitch} height={pitch} fill={tint} opacity={0.22} />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={pitch}
                  stroke={tint}
                  strokeWidth={pitch / 5}
                  opacity={zones.backdropOpacity}
                />
              </pattern>
            ))}
          </defs>
        )}
        {cells.map(({ zone, box }) => {
          const tint = tints.get(zone)
          const id = ids.get(zone)
          return (
            <rect
              key={zone}
              className={`minimap__cell ${tint ? 'minimap__cell--hued' : ''} ${
                zone === focus ? 'minimap__cell--focus' : ''
              }`}
              /* A color per zone cannot be a class, so the value rides in as a
                 custom property and the stylesheet decides what to do with it.
                 The hatch has to ride here too: `fill` as an attribute is a
                 presentation attribute, which any rule in the stylesheet beats. */
              style={
                tint
                  ? ({
                      '--tint': tint,
                      ...(hatched && id ? { fill: `url(#${id})` } : {}),
                    } as CSSProperties)
                  : undefined
              }
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
          )
        })}
      </svg>
    </div>
  )
}
