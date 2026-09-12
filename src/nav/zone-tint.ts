import * as THREE from 'three'

/**
 * A zone's project color, lifted to where it can carry on the wall.
 *
 * The hue is what identifies the project, and a `.hued` background picked to
 * sit behind text is often too dark to stand for one here — so the lightness
 * floor moves and the hue does not. Null for anything three cannot read:
 * hued allows any CSS color name, and a zone whose color is unreadable simply
 * keeps the wall's own palette.
 *
 * One rule, because the wall and its plan have to agree about what a zone's
 * color is — a plan drawn in a different tint reads as a different zone.
 */
export function liftedTint(css: string, minLight: number): THREE.Color | null {
  try {
    const color = new THREE.Color(css)
    const hsl = { h: 0, s: 0, l: 0 }
    color.getHSL(hsl)
    if (hsl.l < minLight) color.setHSL(hsl.h, hsl.s, minLight)
    return color
  } catch {
    return null
  }
}

/** The same, as something a stylesheet or an SVG fill can take. */
export function liftedHex(css: string, minLight: number): string | null {
  const color = liftedTint(css, minLight)
  return color ? `#${color.getHexString()}` : null
}
