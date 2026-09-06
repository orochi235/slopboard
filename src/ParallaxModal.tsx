import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import './parallax-modal.css'

const EASE = 0.09
const REDUCED = '(prefers-reduced-motion: reduce)'

const LAYERS: ReadonlyArray<readonly [string, string]> = [
  ['starfield', '-260'],
  ['glow', '-180'],
  ['wordmark', '-110'],
  ['plate', '-30'],
  ['body', '+10'],
  ['crest', '+70'],
  ['chip', '+110'],
]

const clamp = (n: number) => (n < -1 ? -1 : n > 1 ? 1 : n)

/**
 * A card whose parts sit on real Z planes inside one perspective, so pointer
 * movement swings them past each other rather than sliding them in the plane.
 */
export function ParallaxModal() {
  const [open, setOpen] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const deck = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0, mx: 50, my: 50 })
  const centre = useRef({ x: 0, y: 0, w: 1, h: 1 })

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?') setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])

  // The deck's own rect is the rotated bounding box, so reading it per frame
  // would feed the tilt back into itself. Measure the upright stage instead.
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const r = stage.current?.getBoundingClientRect()
      if (!r) return
      centre.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = deck.current
    if (!el) return
    if (window.matchMedia(REDUCED).matches) return
    let x = 0
    let y = 0
    let mx = 50
    let my = 50
    let id = 0
    const tick = () => {
      const t = target.current
      x += (t.x - x) * EASE
      y += (t.y - y) * EASE
      mx += (t.mx - mx) * EASE
      my += (t.my - my) * EASE
      el.style.setProperty('--px', x.toFixed(4))
      el.style.setProperty('--py', y.toFixed(4))
      el.style.setProperty('--mx', `${mx.toFixed(2)}%`)
      el.style.setProperty('--my', `${my.toFixed(2)}%`)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [open])

  const onPointerMove = (e: PointerEvent) => {
    const c = centre.current
    target.current = {
      x: clamp((e.clientX - c.x) / c.w),
      y: clamp((e.clientY - c.y) / c.h),
      mx: ((e.clientX - c.x) / c.w) * 100 + 50,
      my: ((e.clientY - c.y) / c.h) * 100 + 50,
    }
  }

  if (!open) return null

  return (
    <div
      className="pxm"
      role="dialog"
      aria-modal="true"
      aria-label="About slopboard"
      onPointerMove={onPointerMove}
      onClick={close}
    >
      <div className="pxm__stage" ref={stage}>
        <div className="pxm__deck" ref={deck} onClick={(e) => e.stopPropagation()}>
          <div className="pxm__layer pxm__starfield" aria-hidden="true" />
          <div className="pxm__layer pxm__glow" aria-hidden="true" />
          <div className="pxm__layer pxm__wordmark" aria-hidden="true">
            SLOP
          </div>
          <div className="pxm__layer pxm__plate" aria-hidden="true" />
          <div className="pxm__layer pxm__body">
            <p className="pxm__lede">
              Images land here and start dying. Nothing on the wall is archival — a render survives
              its time-to-live or it is rescued, and the pile forgets it either way.
            </p>
            <dl className="pxm__specs">
              {LAYERS.map(([name, z]) => (
                <div className="pxm__spec" key={name}>
                  <dt className="pxm__specName">{name}</dt>
                  <dd className="pxm__specZ">{z}</dd>
                </div>
              ))}
            </dl>
            <p className="pxm__hint">
              move the cursor — every row above sits on its own plane
              <span className="pxm__keys">esc</span>
            </p>
          </div>
          <div className="pxm__layer pxm__crest">
            <h2 className="pxm__title">SLOPBOARD</h2>
            <p className="pxm__sub">ephemeral render wall</p>
          </div>
          <div className="pxm__layer pxm__chip">
            <span className="pxm__badge">z-stack</span>
            <button type="button" className="pxm__close" onClick={close} aria-label="Close">
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
