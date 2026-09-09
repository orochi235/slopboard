import { describe, expect, it } from 'vitest'
import { controlFor, controlsOf, decimalsOf, formatStepped } from '@/params.controls.ts'
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

  it('shows a depth stored negative as a positive magnitude, so right is deeper', () => {
    expect(controlFor('step.z', -0.023)).toEqual({
      kind: 'slider',
      path: 'step.z',
      min: 0,
      max: 0.2,
      step: 0.001,
      invert: true,
    })
  })

  it('rejects an inverted value by its shown magnitude, not its stored sign', () => {
    // +0.5 is out of a 0..0.2 range once inverted, and so is -0.5.
    expect(controlFor('step.z', -0.5).kind).toBe('number')
    expect(controlFor('step.z', 0.5).kind).toBe('number')
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

  it('gives a hex colour a picker, chosen by the value rather than by a list', () => {
    expect(controlFor('colors.accent', '#38bdf8')).toEqual({ kind: 'color', path: 'colors.accent' })
  })

  it('leaves a string that is not a colour alone', () => {
    expect(controlFor('colors.accent', '#38bd').kind).toBe('number')
    expect(controlFor('camera.projection', 'orthographic').kind).toBe('choice')
  })

  it('falls back to a typed number for a path with no range', () => {
    expect(controlFor('something.new', 3).kind).toBe('number')
  })

  it('reaches far enough up the zone grid to find the answer', () => {
    // A container is about one unit tall, so a third of it was not headroom.
    expect(controlFor('zoneGrid.gap', 0.02)).toMatchObject({ max: 1 })
  })

  it('ranges every element of a list from one entry, so a rung added later needs none', () => {
    expect(controlFor('camera.margins.0', 1.08)).toEqual({
      kind: 'slider',
      path: 'camera.margins.0',
      min: 1,
      max: 2,
      step: 0.01,
    })
    expect(controlFor('camera.margins.7', 1.2)).toMatchObject({ kind: 'slider' })
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
    const tail = controlsOf(defaultParams).find((c) => c.path === 'lod.tiers.3.maxRank')
    expect(tail?.kind).toBe('number')
  })
})

describe('decimalsOf', () => {
  it('counts the decimals the step is written with', () => {
    expect(decimalsOf(0.001)).toBe(3)
    expect(decimalsOf(0.005)).toBe(3)
    expect(decimalsOf(0.0002)).toBe(4)
    expect(decimalsOf(0.5)).toBe(1)
  })

  it('gives a whole step none', () => {
    expect(decimalsOf(1)).toBe(0)
    expect(decimalsOf(10)).toBe(0)
    expect(decimalsOf(16 * 1024 * 1024)).toBe(0)
  })
})

describe('formatStepped', () => {
  it('holds the trailing zeros, so a column keeps its point in one place', () => {
    expect(formatStepped(0.3, 0.005)).toBe('0.300')
    expect(formatStepped(1, 0.01)).toBe('1.00')
  })

  it('keeps a whole-stepped value whole', () => {
    expect(formatStepped(420, 10)).toBe('420')
    expect(formatStepped(22, 1)).toBe('22')
  })

  it('carries the sign', () => {
    expect(formatStepped(-0.013, 0.001)).toBe('-0.013')
  })

  // The old show() sent everything past 1000 to exponential, which made
  // shoveMs read 3.00e+3. Only budgetBytes is genuinely too wide.
  it('goes exponential only past a million', () => {
    expect(formatStepped(3000, 10)).toBe('3000')
    expect(formatStepped(268435456, 16 * 1024 * 1024)).toBe('2.68e+8')
  })
})
