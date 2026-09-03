import * as THREE from 'three'

/** Drawn at a fixed pixel height and scaled in world units by the caller, so a
 *  label stays crisp at any camera distance the wall actually uses. */
const PX = 96
const PAD = 16

/**
 * A transparent canvas holding one line of text, plus the aspect the caller
 * needs to size a sprite without measuring the text again.
 */
export function labelTexture(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `600 ${PX}px ui-monospace, SFMono-Regular, Menlo, monospace`

  ctx.font = font
  const width = Math.ceil(ctx.measureText(text).width) + PAD * 2
  canvas.width = width
  canvas.height = PX + PAD * 2

  // Sizing the canvas resets the context, so everything is set again here.
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(226, 232, 240, 0.92)'
  ctx.fillText(text, PAD, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return { texture, aspect: canvas.width / canvas.height }
}
