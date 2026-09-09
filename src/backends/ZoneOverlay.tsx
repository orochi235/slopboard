import { useFrame, useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import { CHROME_ORDER } from '@/backends/order.ts'
import { createBackdropMaterial } from '@/backends/hatch.ts'
import { createLoop, loopPositions, setResolution } from '@/backends/fatLines.ts'
import type { StackParams } from '@/params.ts'
import { rampAt, rampOf, rampTo } from '@/ramp.ts'
import { labelTexture } from '@/textures/label.ts'
import { createChips, inkFor } from '@/textures/chip.ts'

type Props = {
  /** Written by the wall's frame loop, so the outlines track a growing pile. */
  cells: RefObject<Map<string, Rect>>
  /** Written by the wall's frame loop, like `cells`: how many artifacts each
   *  zone holds, which is what its corner chip says. */
  counts: RefObject<Map<string, number>>
  chips: StackParams['chips']
  /** The camera's move duration, so a chip's shrink rides the same flight. */
  moveMs: number
  zones: string[]
  focus: string | null
  settings: StackParams['zones']
  colors: StackParams['colors']
  /** A zone's project colour, where the daemon found one. */
  hued: Map<string, THREE.Color>
  /** The face labels are drawn in, plus a token that changes once the vendored
   *  faces have loaded — a label built before then wears the fallback. */
  family: string
  fontsReady: boolean
}

/**
 * Just behind the zone outline, which sits at 0 — near enough to read as the
 * same plane, far enough not to fight it. It does not follow the pile's depth:
 * the material writes no depth and draws before the cards, so it never
 * occludes them however far back they go, and a plane parked at the deepest
 * rank visibly parallaxes away from its own border the moment the wall turns.
 */
const BACKDROP_Z = -0.001

/**
 * The zone's frame is the wall a pile hangs on, and the wall draws its cards at
 * 0. So the whole frame sits below that, in the order it stacks: the hatched
 * backdrop, the border over it, the count over both, and every artifact the
 * zone holds over all of it.
 */
const BACKDROP_ORDER = -3
const OUTLINE_ORDER = -2
const CHIP_ORDER = -1

/** A rect's four corners, in three's world space — the one place besides the
 *  card meshes that has to undo windease's downward-growing y. */
function corners(box: Rect): number[] {
  return loopPositions(box.x, -box.y, box.x + box.w, -(box.y + box.h))
}

/**
 * Zone extents drawn into the scene rather than over it, so they turn with the
 * wall. Off by default: a diagnostic first, and furniture only once the labels
 * earn their place in the design.
 */
export function ZoneOverlay({
  cells,
  counts,
  chips: chipSettings,
  moveMs,
  zones,
  focus,
  settings,
  colors,
  hued,
  family,
  fontsReady,
}: Props) {
  const { gl } = useThree()
  const chipRamp = useRef(rampOf(1))
  const idle = useMemo(() => new THREE.Color(colors.zoneIdle), [colors.zoneIdle])
  const highlight = useMemo(() => new THREE.Color(colors.zoneFocus), [colors.zoneFocus])
  const outlines = useMemo(
    () =>
      new Map(
        zones.map((zone) => {
          const line = createLoop()
          line.renderOrder = OUTLINE_ORDER
          return [zone, line] as const
        }),
      ),
    [zones],
  )

  const backdrops = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1)
    return {
      quad,
      byZone: new Map(
        zones.map((zone) => {
          const mesh = new THREE.Mesh(quad, createBackdropMaterial())
          // Behind the cards in every sense: it never occludes and never
          // takes a pick.
          mesh.renderOrder = BACKDROP_ORDER
          mesh.raycast = () => null
          return [zone, mesh] as const
        }),
      ),
    }
  }, [zones])

  const labels = useMemo(() => {
    return new Map(
      zones.map((zone) => {
        // A label is a canvas texture, so its colour is baked at build time
        // rather than set per frame like the outline's.
        const own = settings.huedFrame ? hued.get(zone) : undefined
        const ink = own ? `#${own.getHexString()}` : colors.label
        const { texture, aspect } = labelTexture(zone, ink, family)
        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        })
        const sprite = new THREE.Sprite(material)
        sprite.renderOrder = CHROME_ORDER
        return [zone, { sprite, aspect }] as const
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontsReady is a
    // rebuild token, not a value the labels read.
  }, [zones, colors.label, settings.huedFrame, hued, family, fontsReady])

  // The count is part of the wall a pile hangs on, so the pile covers it rather
  // than the other way round.
  const chips = useMemo(() => createChips(CHIP_ORDER), [])
  useEffect(() => () => chips.dispose(), [chips])
  const chipPlates = useMemo(
    () => new Map(zones.map((zone) => [zone, chips.ensure(zone)] as const)),
    [zones, chips],
  )

  useEffect(
    () => () => {
      backdrops.quad.dispose()
      for (const mesh of backdrops.byZone.values()) (mesh.material as THREE.Material).dispose()
    },
    [backdrops],
  )

  useEffect(
    () => () => {
      for (const line of outlines.values()) {
        line.geometry.dispose()
        line.material.dispose()
      }
      for (const { sprite } of labels.values()) {
        sprite.material.map?.dispose()
        sprite.material.dispose()
      }
    },
    [outlines, labels],
  )

  useFrame(() => {
    const angle = (settings.hatchAngleDeg * Math.PI) / 180
    for (const [zone, mesh] of backdrops.byZone) {
      const box = cells.current?.get(zone)
      mesh.visible = settings.backdrop !== 'none' && !!box
      if (!box || !mesh.visible) continue
      mesh.scale.set(box.w, box.h, 1)
      // A rect's x/y is its top-left and three positions a plane by its centre,
      // in a world whose y grows the other way.
      mesh.position.set(box.x + box.w / 2, -(box.y + box.h / 2), BACKDROP_Z)

      const u = (mesh.material as THREE.ShaderMaterial).uniforms
      const ownBackdrop = settings.huedBackdrop ? hued.get(zone) : undefined
      if (ownBackdrop) u.uColor.value.copy(ownBackdrop)
      else u.uColor.value.set(colors.zoneBackdrop)
      u.uOpacity.value = settings.backdropOpacity
      u.uSpacing.value = Math.max(1e-4, settings.hatchSpacing)
      u.uWidth.value = settings.hatchWidth
      u.uAngle.value = angle
      u.uSolid.value = settings.backdrop === 'solid' ? 1 : 0
    }

    for (const [zone, line] of outlines) {
      const box = cells.current?.get(zone)
      line.visible = settings.outline && !!box
      if (!box) continue
      line.geometry.setPositions(corners(box))
      line.computeLineDistances()
      const own = settings.huedFrame ? hued.get(zone) : undefined
      line.material.color.copy(own ?? (zone === focus ? highlight : idle))
      line.material.linewidth = settings.outlineWidth
      line.material.opacity = 0.65
      setResolution(line.material, gl)
    }

    for (const [zone, { sprite, aspect }] of labels) {
      const box = cells.current?.get(zone)
      sprite.visible = settings.labels && !!box
      if (!box) continue
      const h = settings.labelSize
      sprite.scale.set(h * aspect, h, 1)
      // Turned a quarter turn and stood on the cell's left edge, climbing. A
      // sprite always faces the camera, so the turn is the material's — screen
      // space — and the scale stays in the sprite's own unrotated axes.
      sprite.material.rotation = Math.PI / 2
      // Reading bottom to top, so the run starts at the cell's floor. This also
      // keeps the name clear of the top-left corner, which is where a flagged
      // artifact's badge sits.
      //
      // `labelAlign` slides it across the cell and `labelOffset` pushes it out
      // past the border, so the pair covers both "which edge" and "how far
      // clear of it" without a second concept for the right-hand side.
      const across = box.x + settings.labelAlign * box.w
      const outward = settings.labelAlign < 0.5 ? -settings.labelOffset : settings.labelOffset
      sprite.position.set(across + outward - h / 2, -(box.y + box.h) + (h * aspect) / 2, 0)
    }

    // Shrunk once the view is inside a zone, for the same reason the age chip
    // is: the frame the count marks is what the camera came closer to. Ramped
    // on the camera's own clock so it travels with the move, not after it.
    const now = Date.now()
    chipRamp.current = rampTo(chipRamp.current, focus ? chipSettings.shrink : 1, now, moveMs)
    const chipHeight = chipSettings.size * rampAt(chipRamp.current, now, moveMs)

    for (const zone of zones) {
      const box = cells.current?.get(zone)
      const count = counts.current?.get(zone) ?? 0
      const shows = chipSettings.zones && !!box && count > 0
      const text = String(count)
      // The outline's own color, by the outline's own rule: the chip straddles
      // that border and is part of the same frame, so the two must not disagree
      // about whose zone this is.
      const own = settings.huedFrame ? hued.get(zone) : undefined
      const paint = own ?? (zone === focus ? highlight : idle)
      const fill = `#${paint.getHexString()}`
      const ink = inkFor(fill, colors.chipInk, colors.chipFill)
      const held = chips.sync(
        zone,
        `${text}|${fill}|${ink}|${family}|${fontsReady}`,
        text,
        { fill, ink, family },
      )
      held.plate.visible = shows
      if (!box || !shows) continue
      held.plate.scale.set(chipHeight * held.aspect, chipHeight, 1)
      // Centered on the cell's bottom-right corner, straddling the border, and
      // coplanar with it: a chip standing proud of the zone reads as a sticker
      // in front of the wall the moment it turns.
      held.plate.position.set(
        box.x + box.w + chipSettings.bleed,
        -(box.y + box.h) - chipSettings.bleed,
        0,
      )
    }
  })

  return (
    <group>
      {zones.map((zone) => {
        const line = outlines.get(zone)
        const label = labels.get(zone)
        const backdrop = backdrops.byZone.get(zone)
        return (
          <group key={zone}>
            {backdrop && <primitive object={backdrop} />}
            {line && <primitive object={line} />}
            {label && <primitive object={label.sprite} />}
            {chipPlates.get(zone) && <primitive object={chipPlates.get(zone)!.plate} />}
          </group>
        )
      })}
    </group>
  )
}
