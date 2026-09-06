import * as THREE from 'three'
import { wrapLines } from '@/textures/text.ts'

/** Drawn at a fixed pixel height and scaled in world units by the caller, so a
 *  badge stays crisp at any camera distance the wall actually uses. */
const PX = 160
const PAD_X = 48
const PAD_Y = 26
const LINE = 1.18
/** Long enough to say what is wrong, short enough to read across a room. A
 *  plate wider than this stops being signage and starts being a paragraph. */
const MAX_WIDTH = PX * 9
const MAX_LINES = 2

const RADIUS = 22

/**
 * A filled plate with one line of text: what a flagged card wears on its top
 * edge. A plate rather than bare text because the loud levels have to read as
 * signage — white on red — and text alone cannot carry a field colour.
 */
export function badgeTexture(
  text: string,
  plate: string,
  ink: string,
  family: string,
): { texture: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `600 ${PX}px ${family}`

  ctx.font = font
  const lines = wrapLines(ctx, text, MAX_WIDTH, MAX_LINES)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  canvas.width = Math.ceil(widest) + PAD_X * 2
  canvas.height = Math.ceil(PX * LINE * lines.length) + PAD_Y * 2

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
  const step = PX * LINE
  const top = (canvas.height - step * lines.length) / 2
  lines.forEach((line, i) => ctx.fillText(line, PAD_X, top + step * (i + 0.5)))

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return { texture, aspect: canvas.width / canvas.height }
}
