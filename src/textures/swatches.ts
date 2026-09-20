import * as THREE from 'three'
import { BACKDROPS, type Backdrop } from '@shared/backdrops.ts'
import { PATTERN_INDEX } from '@/backdrops.ts'
import { createBackdropMaterial } from '@/backends/hatch.ts'

let cached: Partial<Record<Backdrop, string>> | null = null

/** The set, drawn once for the page. Two panels offer these and a sheet is
 *  opened repeatedly; the patterns do not change between openings. */
export function swatches(): Partial<Record<Backdrop, string>> {
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
export function renderSwatches(size = 96): Partial<Record<Backdrop, string>> {
  const out: Partial<Record<Backdrop, string>> = {}
  let renderer: THREE.WebGLRenderer | null = null
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      // Without this the buffer may be cleared before toDataURL reads it.
      preserveDrawingBuffer: true,
    })
    renderer.setSize(size, size, false)
    renderer.setClearAlpha(0)

    const scene = new THREE.Scene()
    // The plane is one unit, so world space here runs -0.5 to 0.5 and the
    // spacing below is read as a fraction of the swatch.
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
    // A sixth, so the pattern meets its own edge: the swatch is repeated as a
    // tile, and a pitch that does not divide the square leaves a visible step
    // at every repeat. Six takes the patterns built on one, two and three
    // spacings — plain rules, brick and basketweave, parquet — all of which
    // land on a whole number of periods across.
    material.uniforms.uSpacing!.value = 1 / 6
    material.uniforms.uWidth!.value = 0.022

    const geometry = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    for (const backdrop of BACKDROPS) {
      // `none` draws nothing, and the shader has no case for it — its cover
      // stays at the initial 1.0, so asking for it would hand back a solid
      // square and offer the opposite of what it means.
      if (backdrop === 'none') continue
      material.uniforms.uPattern!.value = PATTERN_INDEX[backdrop]
      renderer.render(scene, camera)
      out[backdrop] = renderer.domElement.toDataURL()
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
