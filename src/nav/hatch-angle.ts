/**
 * The wall's hatch angle, as an SVG rotation that draws the same strokes.
 *
 * The wall rules its hatch in world space, where y grows up: the shader keeps
 * the lines of `x·cos a + y·sin a`, which run at screen slope −cot a. An SVG
 * rotation of a vertical line gives +cot a, because there y grows down. The
 * two are mirrored at every angle, not just at some — which is the part worth
 * writing down, because a thin strip of hatch on a tilted wall reads as either
 * one and cannot settle it.
 */
export const hatchRotation = (worldAngleDeg: number): number => -worldAngleDeg

const RAD = Math.PI / 180

/** Screen slope of the wall's ruled lines, y up. The shader's own geometry. */
export const wallHatchSlope = (deg: number): number =>
  Math.cos(deg * RAD) / -Math.sin(deg * RAD)

/** Screen slope of a vertical line under an SVG rotation, y up. */
export const svgHatchSlope = (deg: number): number =>
  -Math.cos(deg * RAD) / -Math.sin(deg * RAD)
