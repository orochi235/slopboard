import type { StackParams } from '@/params.ts'

type Camera = StackParams['camera']

/** The camera the reset button puts back: head-on, with the wall framed at
 *  `homeMargin`. The deeper rungs keep their own framing. */
export function homeCamera(camera: Camera): Camera {
  return {
    ...camera,
    yawDeg: 0,
    pitchDeg: 0,
    margins: [camera.homeMargin, ...camera.margins.slice(1)],
  }
}
