import * as THREE from 'three'
import { CHROME_ORDER } from '@/backends/order.ts'

/** Drawn at a fixed pixel height and scaled into world units here, so a chip
 *  stays crisp at any distance the wall is read from. */
const PX = 96
/** Everything below is a fraction of that height, so one number sizes a chip. */
const PAD = 0.22
const RADIUS = 0.3
const FONT = 0.5
/** The clock stands as tall as a digit, not as tall as the line: an icon sized
 *  to the em box reads as the label and leaves the number looking like a note
 *  on it. Cap height of `FONT` is about seven tenths of it. */
const ICON = FONT * 0.7
const GAP = 0.12

export type ChipLook = {
  fill: string
  ink: string
  /** Color of the clock glyph. Omitted, the chip is text alone. */
  icon?: string
  family: string
  /** World height of the whole chip. */
  height: number
}

/** A clock face at 12:15, stroked into a box of `size` at (x, y). Drawn rather
 *  than set in a font: every face the wall vendors is a text face, and pulling
 *  an icon font in to draw one glyph costs a binary. */
function clockGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = size / 2
  const cx = x + r
  const cy = y + r
  ctx.lineWidth = size * 0.12
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy - r * 0.52)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + r * 0.42, cy)
  ctx.stroke()
}

/**
 * A small plate that stands in a corner: how old the front card is, how many
 * artifacts a zone holds. Rounded on all four corners, unlike an attention
 * badge, because it sits inside its subject rather than welded to an edge.
 */
export function chipTexture(
  text: string,
  { fill, ink, icon, family, height }: ChipLook,
): { texture: THREE.CanvasTexture; width: number; height: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `600 ${PX * FONT}px ${family}`
  ctx.font = font

  const glyph = icon ? PX * ICON + PX * GAP : 0
  const textWidth = ctx.measureText(text).width
  canvas.width = Math.ceil(PX * PAD * 2 + glyph + textWidth)
  canvas.height = PX

  // Sizing the canvas resets the context, so everything is set again here.
  ctx.font = font
  ctx.textBaseline = 'middle'

  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(0, 0, canvas.width, canvas.height, PX * RADIUS)
  ctx.fill()

  if (icon) {
    ctx.strokeStyle = icon
    clockGlyph(ctx, PX * PAD, (PX - PX * ICON) / 2, PX * ICON)
  }

  ctx.fillStyle = ink
  ctx.fillText(text, PX * PAD + glyph, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return { texture, width: (height * canvas.width) / canvas.height, height }
}

/** sRGB relative luminance, per WCAG. */
function luminanceOf(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const r = channel((n >> 16) & 255)
  const g = channel((n >> 8) & 255)
  const b = channel(n & 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/**
 * Which of two inks to strike a plate with. A zone chip is filled with its
 * project's color, which is picked to be findable on a dark wall and not to
 * carry text, so a fixed ink is unreadable on half of them.
 *
 * By contrast ratio rather than a lightness threshold: green carries most of
 * the luminance sum, so any threshold that keeps white on a mid blue also keeps
 * it on a mid green, where it measures 2.5:1.
 */
export function inkFor(fill: string, onDark: string, onLight: string): string {
  const plate = luminanceOf(fill)
  return contrast(plate, luminanceOf(onDark)) >= contrast(plate, luminanceOf(onLight))
    ? onDark
    : onLight
}

export type HeldChip = { plate: THREE.Mesh; key: string; w: number; h: number }

/**
 * The plates, one per subject, rebuilt only when what they say changes — a chip
 * counting seconds redraws once a second rather than once a frame.
 *
 * Shared by the cards and the zones because the three.js plumbing is the whole
 * of it: a plane in the subject's own frame, composited over the wall.
 */
/**
 * `renderOrder` is what decides whether the wall's cards cover a chip or the
 * chip covers them: a card chip is chrome over its own artifact, while a zone's
 * count belongs to the frame the pile hangs on and has to sit behind it.
 */
export function createChips(renderOrder: number = CHROME_ORDER) {
  const quad = new THREE.PlaneGeometry(1, 1)
  const byId = new Map<string, HeldChip>()

  /** The plate alone, before it says anything. Separate from `sync` because a
   *  subject's plates are mounted by React and written by the frame loop: one
   *  created mid-frame would not be in the scene until something else forced a
   *  render, which for a stable set of zones is never. */
  function ensure(id: string): HeldChip {
    let held = byId.get(id)
    if (!held) {
      // A plane rather than a sprite, so a chip lies in its subject's plane
      // and turns with the wall.
      const plate = new THREE.Mesh(
        quad,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      )
      plate.renderOrder = renderOrder
      // A readout, not a target: the card underneath keeps the whole pick.
      plate.raycast = () => null
      held = { plate, key: '', w: 0, h: 0 }
      byId.set(id, held)
    }
    return held
  }

  return {
    quad,
    byId,
    ensure,
    sync(id: string, key: string, text: string, look: ChipLook): HeldChip {
      const held = ensure(id)
      if (held.key !== key) {
        const material = held.plate.material as THREE.MeshBasicMaterial
        material.map?.dispose()
        const { texture, width, height } = chipTexture(text, look)
        material.map = texture
        material.needsUpdate = true
        held.key = key
        held.w = width
        held.h = height
      }
      return held
    },
    dispose() {
      for (const { plate } of byId.values()) {
        const material = plate.material as THREE.MeshBasicMaterial
        material.map?.dispose()
        material.dispose()
      }
      byId.clear()
      quad.dispose()
    },
  }
}
