import { describe, expect, it } from 'vitest'
import { controlFor, controlsOf } from '@/params.controls.ts'
import { defaultParams } from '@/params.ts'

describe('controlFor', () => {
  it('gives a known number a slider over a range wide enough to search', () => {
    expect(controlFor('camera.pitchDeg', 0)).toEqual({
      kind: 'slider',
      path: 'camera.pitchDeg',
      min: -90,
      max: 90,
      step: 1,
    })
  })

  it('gives an enum its own values rather than a range', () => {
    const c = controlFor('camera.projection', 'orthographic')
    expect(c).toEqual({
      kind: 'choice',
      path: 'camera.projection',
      options: ['orthographic', 'perspective'],
    })
  })

  it('offers an LOD edge only the sizes a tier can actually be', () => {
    expect(controlFor('lod.0.edge', 512)).toEqual({
      kind: 'choice',
      path: 'lod.0.edge',
      options: [0, 32, 128, 512],
    })
  })

  it('falls back to a typed number for a value no slider can express', () => {
    expect(controlFor('lod.3.maxRank', Number.MAX_SAFE_INTEGER).kind).toBe('number')
    expect(controlFor('lod.0.maxRank', 1).kind).toBe('slider')
  })

  it('falls back to a typed number for a path with no range', () => {
    expect(controlFor('something.new', 3).kind).toBe('number')
  })
})

describe('controlsOf', () => {
  it('covers every leaf of the params, in the order they are declared', () => {
    const paths = controlsOf(defaultParams).map((c) => c.path)
    expect(paths).toContain('step.z')
    expect(paths).toContain('origin.x')
    expect(paths).toContain('camera.projection')
    expect(paths).toContain('camera.yawDeg')
    expect(paths.indexOf('step.x')).toBeLessThan(paths.indexOf('camera.fovDeg'))
  })

  it('leaves the deep-tail sentinel typeable rather than draggable', () => {
    const tail = controlsOf(defaultParams).find((c) => c.path === 'lod.3.maxRank')
    expect(tail?.kind).toBe('number')
  })
})
