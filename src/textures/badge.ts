import * as THREE from 'three'
import { wrapLines } from '@/textures/text.ts'
import { LABEL_WEIGHT } from '@/typeface.ts'

/** Drawn at a fixed pixel height and scaled into world units by this module,
 *  so a badge stays crisp at any camera distance the wall actually uses. */
const PX = 160
const PAD_X = 48
const PAD_Y = 26
const LINE = 1.18
/** Two lines of signage. A third is a paragraph, and nobody reads a paragraph
 *  welded to the top of a picture. */
const MAX_LINES = 2

const RADIUS = 22

/**
 * A filled plate with one line or two: what a flagged artifact wears on its top
 * edge. A plate rather than bare text because the loud levels have to read as
 * signage — white on red — and text alone cannot carry a field colour.
 *
 * Sized in world units here rather than by the caller, because how wide the
 * plate may run and how tall it ends up are the same question: the text is
 * wrapped to fit the width it is allowed, and the height follows from how many
 * lines that took.
 */
export function badgeTexture(
  text: string,
  fill: string,
  ink: string,
  family: string,
  /** World height of one line. */
  lineHeight: number,
  /** World width the plate must not exceed. */
  maxWidth: number,
): { texture: THREE.CanvasTexture; width: number; height: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `${LABEL_WEIGHT} ${PX}px ${family}`
  ctx.font = font

  // One line's canvas height is the scale factor between the two spaces, so the
  // world cap converts into the pixel cap the wrapper needs.
  const lineBox = PX * LINE + PAD_Y * 2
  const maxWidthPx = Math.max(PX, (maxWidth / lineHeight) * lineBox - PAD_X * 2)

  const lines = wrapLines(ctx, text, maxWidthPx, MAX_LINES)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  canvas.width = Math.ceil(widest) + PAD_X * 2
  canvas.height = Math.ceil(PX * LINE * lines.length) + PAD_Y * 2

  // Sizing the canvas resets the context, so everything is set again here.
  ctx.font = font
  ctx.textBaseline = 'middle'

  ctx.fillStyle = fill
  ctx.beginPath()
  // Square along the bottom, where the badge meets the artifact's own border,
  // and rounded above it — so it reads as welded on rather than floating over.
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
  // Height grows with the line count, so a wrapped plate is taller rather than
  // squashing two lines into the space of one.
  const height = (lineHeight * canvas.height) / lineBox
  return { texture, width: (height * canvas.width) / canvas.height, height }
}
