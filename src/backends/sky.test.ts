import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createSkyMaterial, spreadOf, srgb } from '@/backends/sky.ts'
import { defaultParams, type StackParams } from '@/params.ts'

describe('spreadOf', () => {
  it('is the tangent of the half-angle, so 90 degrees of sky spans 2 at unit depth', () => {
    expect(spreadOf(90)).toBeCloseTo(1)
  })

  it('clamps rather than reaching the asymptote, where the ray would blow up', () => {
    expect(Number.isFinite(spreadOf(180))).toBe(true)
    expect(Number.isFinite(spreadOf(0))).toBe(true)
    expect(spreadOf(0)).toBeGreaterThan(0)
  })
})

describe('createSkyMaterial', () => {
  it('never occludes or depth-tests, so no card can be lost behind it', () => {
    const m = createSkyMaterial()
    expect(m.depthTest).toBe(false)
    expect(m.depthWrite).toBe(false)
  })

  it('declares a uniform for every sky param, or the knob drags nothing', () => {
    // `enabled` is visibility rather than a uniform; everything else has to
    // reach the shader, and a param added without one is silently inert.
    const drives: Record<keyof Omit<StackParams['sky'], 'enabled'>, string> = {
      spreadDeg: 'uSpread',
      scale: 'uScale',
      octaves: 'uOctaves',
      intensity: 'uIntensity',
      contrast: 'uContrast',
      starDensity: 'uStarDensity',
      starIntensity: 'uStarIntensity',
    }
    const declared = Object.keys(createSkyMaterial().uniforms)
    expect(Object.keys(drives).sort()).toEqual(
      Object.keys(defaultParams.sky)
        .filter((k) => k !== 'enabled')
        .sort(),
    )
    for (const name of Object.values(drives)) expect(declared).toContain(name)
    expect(declared).toContain('uBase')
    expect(declared).toContain('uGlow')
  })
})

describe('srgb', () => {
  it('keeps an authored hex raw, where three would darken it into linear space', () => {
    const raw = srgb(new THREE.Color(), '#2b3f6b')
    const converted = new THREE.Color().set('#2b3f6b')
    expect(raw.r).toBeCloseTo(0x2b / 255, 3)
    expect(converted.r).toBeLessThan(raw.r)
  })
})
