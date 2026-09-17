import { describe, expect, it } from 'vitest'
import { defaultParams } from '@/params.ts'
import { homeCamera } from './home.ts'

describe('homeCamera', () => {
  const turned = {
    ...defaultParams.camera,
    yawDeg: 40,
    pitchDeg: -25,
    margins: [1.5, 1.3, 1.2],
    homeMargin: 1.1,
  }

  it('faces the wall head-on', () => {
    const home = homeCamera(turned)
    expect(home.yawDeg).toBe(0)
    expect(home.pitchDeg).toBe(0)
  })

  it('frames the wall at the home distance and leaves the deeper rungs alone', () => {
    expect(homeCamera(turned).margins).toEqual([1.1, 1.3, 1.2])
  })

  it('touches nothing else about the camera', () => {
    const { yawDeg: _y, pitchDeg: _p, margins: _m, ...rest } = homeCamera(turned)
    const { yawDeg: _y2, pitchDeg: _p2, margins: _m2, ...before } = turned
    expect(rest).toEqual(before)
  })
})
