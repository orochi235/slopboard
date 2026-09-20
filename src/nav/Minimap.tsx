import { type CSSProperties, useMemo } from 'react'
import type { Rect } from 'windease'
import type { ZoneSettings } from '@shared/protocol.ts'
import type { StackParams } from '@/params.ts'
import { angleFor, backdropFor } from '@/zone-settings.ts'
import { hatchRotation } from '@/nav/hatch-angle.ts'
import { swatches } from '@/textures/swatches.ts'
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
  zoneSettings,
  onFocus,
}: {
  cells: MinimapCell[]
  focus: string | null
  /** Each zone's lifted project color, where it has one. */
  tints: ReadonlyMap<string, string>
  /** The wall's own backdrop settings, so the two cannot disagree. */
  zones: StackParams['zones']
  /** What each zone overrides, for the same reason: a pile ruled in dots on
   *  the wall and hatched here reads as somewhere else. */
  zoneSettings: Record<string, ZoneSettings>
  onFocus: (zone: string) => void
}) {
  // The icons' own extent. A pile steps back and to the left as it deepens, so
  // framing everything drawn leaves the plan sitting in a margin of the sprawl
  // nobody reads off a box this size.
  const bounds = unionOf(cells.map((c) => c.box))
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null

  // The real pattern, not a stand-in for it. These are the pictures the
  // swatches wear, drawn by the shader that draws the wall — so the plan is
  // never wrong about which pattern a zone is ruled in, and there is no second
  // implementation of seventeen patterns here to drift from the first.
  const masks = useMemo(() => swatches(), [])

  const ruleFor = (zone: string) => {
    const backdrop = backdropFor(zoneSettings[zone], zones.backdrop)
    return {
      backdrop,
      // `solid` has a swatch, but it is a filled square — the ground already
      // draws that, and laying it over itself only doubles the tint.
      hatched: zones.huedBackdrop && backdrop !== 'none' && backdrop !== 'solid',
      mask: masks[backdrop],
      // A zone that turned its own ruling turns here too, or the plan says one
      // thing about the wall while the wall says another.
      angle: angleFor(zoneSettings[zone], zones.hatchAngleDeg),
    }
  }
  const hatched = [...tints.keys()].some((zone) => ruleFor(zone).hatched)
  // The plan is an icon, not a scale drawing. The wall's spacing is in these
  // same units, and at the size of this box it would lay down a hundred and
  // fifty lines — a flat tint with a cost. The angle is the zone's; the pitch
  // is whatever reads here. A swatch already holds a few repeats of its
  // pattern, so a tile here is several of the wall's.
  const pitch = bounds.h / 6

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
            {[...tints].map(([zone]) => {
              const mask = ruleFor(zone).mask
              return (
                mask && (
                  <mask key={`${zone}-mask`} id={`${ids.get(zone)}-mask`}>
                    <image
                      href={mask}
                      x={0}
                      y={0}
                      width={pitch}
                      height={pitch}
                      preserveAspectRatio="none"
                    />
                  </mask>
                )
              )
            })}
            {[...tints].map(([zone, tint]) => (
              <pattern
                key={zone}
                id={ids.get(zone)}
                patternUnits="userSpaceOnUse"
                width={pitch}
                height={pitch}
                // The swatch is drawn square on, so the whole angle is applied
                // here — the zone's own where it set one, the wall's where it
                // did not. An angle baked into the render would be added to
                // this one and the plan would be ruled off the wall it
                // describes.
                patternTransform={`rotate(${hatchRotation(ruleFor(zone).angle)})`}
              >
                {/* The zone's ground, then its pattern over it: one fill has to
                    carry both, and a pattern is the only fill that can. */}
                <rect x={0} y={0} width={pitch} height={pitch} fill={tint} opacity={0.22} />
                {/* The swatch is white on transparent, so it is worn as a mask
                    over the zone's own tint rather than drawn — one render
                    then serves every zone, the way the sheet wears it. */}
                {ruleFor(zone).mask && (
                  <rect
                    x={0}
                    y={0}
                    width={pitch}
                    height={pitch}
                    fill={tint}
                    opacity={zones.backdropOpacity}
                    mask={`url(#${ids.get(zone)}-mask)`}
                  />
                )}
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
                      ...(ruleFor(zone).hatched && id ? { fill: `url(#${id})` } : {}),
                    } as CSSProperties)
                  : undefined
              }
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
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
