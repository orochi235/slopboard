import { describe, expect, it } from 'vitest'
import { groupControls } from '@/params.groups.ts'
import type { Control } from '@/params.controls.ts'

const slider = (path: string): Control => ({ kind: 'slider', path, min: 0, max: 1, step: 0.1 })

describe('groupControls', () => {
  it('groups by the first path segment', () => {
    const groups = groupControls([slider('camera.fovDeg'), slider('camera.moveMs'), slider('step.z')])
    expect(groups.map((g) => g.name)).toEqual(['camera', 'step'])
    expect(groups[0]!.controls.map((c) => c.path)).toEqual(['camera.fovDeg', 'camera.moveMs'])
  })

  it('collects the top-level scalars under one group rather than one each', () => {
    const groups = groupControls([slider('side'), slider('camera.fovDeg'), slider('shoveMs')])
    const wall = groups.find((g) => g.name === 'wall')!
    expect(wall.controls.map((c) => c.path)).toEqual(['side', 'shoveMs'])
  })

  it('puts the top-level group first, since it is what a wall is tuned by', () => {
    const groups = groupControls([slider('camera.fovDeg'), slider('side')])
    expect(groups[0]!.name).toBe('wall')
  })

  it('keeps first-appearance order for the rest, so the panel does not reshuffle', () => {
    const groups = groupControls([slider('step.z'), slider('camera.fovDeg'), slider('step.x')])
    expect(groups.map((g) => g.name)).toEqual(['step', 'camera'])
  })

  it('treats an array index as part of its parent group', () => {
    const groups = groupControls([slider('lod.0.edge'), slider('lod.1.edge')])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.name).toBe('lod')
    expect(groups[0]!.controls).toHaveLength(2)
  })

  it('is empty for no controls', () => {
    expect(groupControls([])).toEqual([])
  })
})
