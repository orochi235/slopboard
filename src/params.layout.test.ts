import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/params.ts'
import { layoutKeyOf } from '@/params.layout.ts'
import { setAt } from '@/params.paths.ts'

const keyWith = (path: string, value: number | string | boolean) =>
  layoutKeyOf(setAt(defaultParams, path, value))

describe('layoutKeyOf', () => {
  const base = layoutKeyOf(defaultParams)

  it('ignores what only changes how the wall is displayed', () => {
    // Each of these would otherwise reshuffle every pile on the wall mid-drag.
    expect(keyWith('camera.yawDeg', 30)).toBe(base)
    expect(keyWith('overlay.cardEdges', true)).toBe(base)
    expect(keyWith('zones.backdrop', 'solid')).toBe(base)
    expect(keyWith('sky.intensity', 0.9)).toBe(base)
    expect(keyWith('colors.accent', '#ff0088')).toBe(base)
    expect(keyWith('nav.wheelThreshold', 120)).toBe(base)
  })

  it('changes for anything the arrangement reads, or the change never lands', () => {
    expect(keyWith('side', 0.4)).not.toBe(base)
    expect(keyWith('step.z', -0.1)).not.toBe(base)
    expect(keyWith('fade.from', 0.2)).not.toBe(base)
    expect(keyWith('rankCap', 50)).not.toBe(base)
    expect(keyWith('zoneGrid.gap', 0.1)).not.toBe(base)
  })
})
