import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/params.ts'

describe('defaultParams', () => {
  it('describes the pile, the grid, the camera and the LOD tiers', () => {
    const p = defaultParams
    expect(p.step.z).toBeLessThan(0) // the pile recedes from the camera
    expect(p.shoveMs).toBeGreaterThan(0)
    expect(p.zoneGrid.gap).toBeGreaterThan(0)
    expect(p.camera.fovDeg).toBeGreaterThan(0)
    expect(p.lod.map((t) => t.maxRank)).toEqual([...p.lod.map((t) => t.maxRank)].sort((a, b) => a - b))
    expect(p.lod.at(-1)?.edge).toBe(0) // the tail is a flat colored quad
  })

  it('is a plain object, so a control panel can clone and patch it', () => {
    expect(JSON.parse(JSON.stringify(defaultParams))).toEqual(defaultParams)
  })
})
