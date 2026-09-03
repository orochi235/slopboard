/**
 * Where the camera sits relative to what it looks at, in three's world space —
 * y up. Yaw swings it right around the world's vertical, pitch lifts it; 0,0
 * is straight down -Z, which is the head-on wall.
 */
export function orbitOffset(
  yawDeg: number,
  pitchDeg: number,
  distance: number,
): { x: number; y: number; z: number } {
  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180
  return {
    x: distance * Math.cos(pitch) * Math.sin(yaw),
    y: distance * Math.sin(pitch),
    z: distance * Math.cos(pitch) * Math.cos(yaw),
  }
}
