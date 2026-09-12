import * as THREE from 'three'
import { wrapLines } from '@/textures/text.ts'
import { LABEL_WEIGHT } from '@/typeface.ts'

/** Drawn at a fixed pixel height and scaled in world units by the caller, so a
 *  label stays crisp at any camera distance the wall actually uses. */
const PX = 220
const PAD = 36
/** A zone name is one token, and a turned label's second line would stack
 *  sideways across its own cell — so this one truncates rather than wraps. */
const MAX_WIDTH = PX * 9

/** A triangle pointing up, ahead of the name, on a zone held at the top of the
 *  wall. Drawn rather than set in the text: the vendored faces carry no such
 *  glyph, and an emoji would fall back to the system's colour font and ignore
 *  the ink the rest of the label is drawn in. */
const MARK = PX * 0.42
const MARK_GAP = PX * 0.24

/**
 * A transparent canvas holding one line of text, plus the aspect the caller
 * needs to size a sprite without measuring the text again.
 */
export function labelTexture(
  text: string,
  color: string,
  family: string,
  marked = false,
): { texture: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `${LABEL_WEIGHT} ${PX}px ${family}`

  ctx.font = font
  const shown = wrapLines(ctx, text, MAX_WIDTH, 1)[0] ?? text
  const lead = marked ? MARK + MARK_GAP : 0
  canvas.width = Math.ceil(ctx.measureText(shown).width + lead) + PAD * 2
  canvas.height = PX + PAD * 2

  // Sizing the canvas resets the context, so everything is set again here.
  ctx.font = font
  ctx.textBaseline = 'middle'
  // The alpha stays here rather than in the colour: a picker cannot express it.
  ctx.globalAlpha = 0.92
  ctx.fillStyle = color
  if (marked) {
    const mid = canvas.height / 2
    ctx.beginPath()
    ctx.moveTo(PAD + MARK / 2, mid - MARK / 2)
    ctx.lineTo(PAD + MARK, mid + MARK / 2)
    ctx.lineTo(PAD, mid + MARK / 2)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillText(shown, PAD + lead, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return { texture, aspect: canvas.width / canvas.height }
}
