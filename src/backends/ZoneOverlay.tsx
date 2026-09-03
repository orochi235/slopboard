import { useFrame } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import type { StackParams } from '@/params.ts'
import { labelTexture } from '@/textures/label.ts'

type Props = {
  /** Written by the wall's frame loop, so the outlines track a growing pile. */
  cells: RefObject<Map<string, Rect>>
  zones: string[]
  focus: string | null
  overlay: StackParams['overlay']
}

const IDLE = new THREE.Color('#64748b')
const FOCUS = new THREE.Color('#38bdf8')

/** A rect's four corners, in three's world space — the one place besides the
 *  card meshes that has to undo windease's downward-growing y. */
function corners(box: Rect): number[] {
  const x0 = box.x
  const x1 = box.x + box.w
  const y0 = -box.y
  const y1 = -(box.y + box.h)
  return [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0]
}

/**
 * Zone extents drawn into the scene rather than over it, so they turn with the
 * wall. Off by default: a diagnostic first, and furniture only once the labels
 * earn their place in the design.
 */
export function ZoneOverlay({ cells, zones, focus, overlay }: Props) {
  const outlines = useMemo(() => {
    return new Map(
      zones.map((zone) => {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(4 * 3), 3),
        )
        const material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.65 })
        return [zone, new THREE.LineLoop(geometry, material)] as const
      }),
    )
  }, [zones])

  const labels = useMemo(() => {
    return new Map(
      zones.map((zone) => {
        const { texture, aspect } = labelTexture(zone)
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
        const sprite = new THREE.Sprite(material)
        return [zone, { sprite, aspect }] as const
      }),
    )
  }, [zones])

  useEffect(
    () => () => {
      for (const line of outlines.values()) {
        line.geometry.dispose()
        ;(line.material as THREE.Material).dispose()
      }
      for (const { sprite } of labels.values()) {
        sprite.material.map?.dispose()
        sprite.material.dispose()
      }
    },
    [outlines, labels],
  )

  useFrame(() => {
    for (const [zone, line] of outlines) {
      const box = cells.current?.get(zone)
      line.visible = overlay.zones && !!box
      if (!box) continue
      const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
      attr.array.set(corners(box))
      attr.needsUpdate = true
      line.geometry.computeBoundingSphere()
      ;(line.material as THREE.LineBasicMaterial).color.copy(zone === focus ? FOCUS : IDLE)
    }

    for (const [zone, { sprite, aspect }] of labels) {
      const box = cells.current?.get(zone)
      sprite.visible = overlay.labels && !!box
      if (!box) continue
      const h = overlay.labelSize
      sprite.scale.set(h * aspect, h, 1)
      // Above the cell's top-left, clear of the cards. The camera frames the
      // union of the cells and a label hangs outside that, so it relies on
      // camera.wallMargin / stackMargin for its headroom.
      sprite.position.set(box.x + (h * aspect) / 2, -box.y + h * 0.75, 0)
    }
  })

  return (
    <group>
      {zones.map((zone) => {
        const line = outlines.get(zone)
        const label = labels.get(zone)
        return (
          <group key={zone}>
            {line && <primitive object={line} />}
            {label && <primitive object={label.sprite} />}
          </group>
        )
      })}
    </group>
  )
}
