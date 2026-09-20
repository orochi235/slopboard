import * as THREE from 'three'
import { BACKDROPS, type Backdrop } from '@shared/backdrops.ts'
import { PATTERN_INDEX, PATTERNS } from '@/backdrops.ts'
import { createBackdropMaterial } from '@/backends/hatch.ts'

/** A drawn pattern and the shape of the tile it repeats on. Consumers need the
 *  aspect because several patterns do not repeat on a square. */
export type Swatch = { url: string; aspect: number }

let cached: Partial<Record<Backdrop, Swatch>> | null = null

/** The set, drawn once for the page. Two panels offer these and a sheet is
 *  opened repeatedly; the patterns do not change between openings. */
const SPACING = 0.2
const PERIOD = 0.4
/** How many repeats a swatch shows. One would read as a single motif rather
 *  than as a pattern; more than two and the picker's 96px is a flat tint. */
const REPEATS = 2

export function swatches(): Partial<Record<Backdrop, Swatch>> {
  cached ??= renderSwatches()
  return cached
}

/**
 * A picture of each backdrop, drawn by the shader that draws the wall.
 *
 * Hand-writing these in SVG would be a second implementation of every pattern,
 * and the two would drift the first time one is tuned — `Minimap` already gave
 * up on keeping up and collapses them all to a hatch. Rendering the real
 * material means a swatch cannot be wrong about what it is offering.
 *
 * White on transparent, because the caller wears them as a CSS mask over its
 * own color: one render then serves every zone tint rather than one per zone.
 *
 * Drawn square on and at a pitch that divides the square, because the minimap
 * repeats these as a tile and turns them itself. Anything baked in here — an
 * angle, a pitch that does not meet its own edge — shows up there as a pattern
 * rotated twice, or as a stitch down every tile boundary.
 *
 * Once, at mount. One context for the set, torn down before returning — a
 * live context per swatch would spend nine of the handful a browser gives a
 * page, and nothing here animates.
 */
export function renderSwatches(size = 96): Partial<Record<Backdrop, Swatch>> {
  const out: Partial<Record<Backdrop, Swatch>> = {}
  let renderer: THREE.WebGLRenderer | null = null
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      // Without this the buffer may be cleared before toDataURL reads it.
      preserveDrawingBuffer: true,
    })
    renderer.setClearAlpha(0)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10)
    camera.position.z = 1

    const material = createBackdropMaterial()
    material.uniforms.uColor!.value = new THREE.Color('#ffffff')
    material.uniforms.uOpacity!.value = 1
    // Square on, never the material's default 45 degrees. A consumer applies
    // the angle itself — the minimap turns its whole pattern tile by the
    // zone's — so an angle baked in here is added to that one, and the plan
    // was ruled forty-five degrees off the wall it describes.
    material.uniforms.uAngle!.value = 0

    const geometry = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    for (const backdrop of BACKDROPS) {
      // `none` draws nothing, and the shader has no case for it — its cover
      // stays at the initial 1.0, so asking for it would hand back a solid
      // square and offer the opposite of what it means.
      if (backdrop === 'none') continue

      // Framed on the pattern's own repeat rather than on a square, so the
      // image meets its own edge and can be tiled. `grid` repeats on root two
      // and `hexagons` on root three, so no single square frame could hold
      // both — which is why every swatch carries the aspect it was drawn at.
      const tile = PATTERNS[backdrop].tile(SPACING, PERIOD)
      const aspect = tile.u / tile.v
      const w = aspect >= 1 ? size : Math.round(size * aspect)
      const h = aspect >= 1 ? Math.round(size / aspect) : size
      renderer.setSize(w, h, false)
      // The mesh is the tile, so world space across it runs exactly one
      // repeat: the spacing below is then read against the pattern's own
      // measure rather than against the picture's.
      mesh.scale.set(tile.u * REPEATS, tile.v * REPEATS, 1)
      camera.left = (-tile.u * REPEATS) / 2
      camera.right = (tile.u * REPEATS) / 2
      camera.top = (tile.v * REPEATS) / 2
      camera.bottom = (-tile.v * REPEATS) / 2
      camera.updateProjectionMatrix()

      material.uniforms.uSpacing!.value = SPACING
      material.uniforms.uPeriod!.value = PERIOD
      // Proportional to the pitch rather than fixed, so a pattern framed on a
      // large repeat is not drawn in hairlines.
      material.uniforms.uWidth!.value = SPACING * 0.13
      material.uniforms.uPattern!.value = PATTERN_INDEX[backdrop]
      renderer.render(scene, camera)
      out[backdrop] = { url: renderer.domElement.toDataURL(), aspect }
    }

    geometry.dispose()
    material.dispose()
  } catch {
    // No context, or a browser that refuses to read the buffer back. The
    // caller falls back to names, which is worse but not broken.
  } finally {
    renderer?.dispose()
    renderer?.forceContextLoss()
  }
  return out
}
