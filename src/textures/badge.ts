import * as THREE from 'three'

/** Drawn at a fixed pixel height and scaled in world units by the caller, so a
 *  badge stays crisp at any camera distance the wall actually uses. */
const PX = 72
const PAD_X = 22
const PAD_Y = 12
/** Long enough to say what is wrong, short enough to read across a room. */
const MAX_CHARS = 42

const RADIUS = 10

/**
 * A filled plate with one line of text: what a flagged card wears on its top
 * edge. A plate rather than bare text because the loud levels have to read as
 * signage — white on red — and text alone cannot carry a field colour.
 */
export function badgeTexture(
  text: string,
  plate: string,
  ink: string,
): { texture: THREE.CanvasTexture; aspect: number } {
  const shown = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `600 ${PX}px ui-monospace, SFMono-Regular, Menlo, monospace`

  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(shown).width) + PAD_X * 2
  canvas.height = PX + PAD_Y * 2

  // Sizing the canvas resets the context, so everything is set again here.
  ctx.font = font
  ctx.textBaseline = 'middle'

  ctx.fillStyle = plate
  ctx.beginPath()
  // Square along the bottom, where the badge meets the card's own border, and
  // rounded above it — so it reads as welded on rather than floating over.
  ctx.moveTo(0, canvas.height)
  ctx.lineTo(0, RADIUS)
  ctx.quadraticCurveTo(0, 0, RADIUS, 0)
  ctx.lineTo(canvas.width - RADIUS, 0)
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, RADIUS)
  ctx.lineTo(canvas.width, canvas.height)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = ink
  ctx.fillText(shown, PAD_X, canvas.height / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return { texture, aspect: canvas.width / canvas.height }
}
