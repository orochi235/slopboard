import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { distanceFor, MESH_VIEW } from './mesh.ts'

describe('distanceFor', () => {
  it('holds a unit sphere just outside the frame it fills', () => {
    // sin(17.5°) ≈ 0.3007, so a unit sphere sits about 4.2 back at the margin.
    expect(distanceFor(1)).toBeCloseTo(1.25 / Math.sin((35 * Math.PI) / 360), 6)
  })

  it('scales with the model, so framing is the same at any size', () => {
    expect(distanceFor(10)).toBeCloseTo(distanceFor(1) * 10, 6)
  })

  it('backs off for a narrower field', () => {
    expect(distanceFor(1, 20)).toBeGreaterThan(distanceFor(1, 60))
  })
})

/** The viewer is served to Chrome as plain JavaScript and cannot import the
 *  module above, so it repeats the formula. This is what says so out loud when
 *  one of them changes. */
describe('the poster viewer frames a mesh the same way', () => {
  const viewer = readFileSync(
    fileURLToPath(new URL('../server/meshview.client.js', import.meta.url)),
    'utf8',
  )

  it('repeats the formula verbatim', () => {
    expect(viewer).toContain('(radius * view.margin) / Math.sin((view.fov * Math.PI) / 360)')
  })

  it('reads every constant from the page rather than its own', () => {
    for (const key of Object.keys(MESH_VIEW)) expect(viewer).toContain(`view.${key}`)
  })
})
