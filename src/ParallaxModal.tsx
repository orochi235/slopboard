import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDelaminate } from 'delamin8r/react'
import './parallax-modal.css'

/** The card's parts, back to front. The number is `data-dl-lift`: steps clear
 *  of the plane its siblings tie on, which is the whole of what this file says
 *  about depth — delamin8r turns it into Z, and the rows below read the Z it
 *  arrived at rather than repeating a number written here. */
const LAYERS = [
  'starfield',
  'glow',
  'wordmark',
  'plate',
  'body',
  'crest',
  'chip',
] as const

/** Where the container's own plane falls in the stack. Four of the seven sit
 *  behind it, which is what makes the starfield read as sky rather than as
 *  another sheet on the pile. */
const ORIGIN = 0.7

const signed = (z: number) => `${z < 0 ? '−' : '+'}${Math.abs(Math.round(z))}`

/**
 * A card whose parts sit on real Z planes inside one perspective, so pointer
 * movement swings them past each other rather than sliding them in the plane.
 */
export function ParallaxModal({ allowParallax }: { allowParallax: boolean }) {
  const [open, setOpen] = useState(false)
  const { ref, handle } = useDelaminate<HTMLDivElement>({
    mode: 'tilt',
    origin: ORIGIN,
    // Wider than the spacing delamin8r derives from a card this size. The
    // starfield has to read as sky rather than as the next sheet down, and
    // that is a distance rather than a color.
    step: 53,
    // The whole overlay is the card's field: the pointer crossing the scrim is
    // still aimed at the card, so it keeps driving rather than recentering.
    recenterOnLeave: false,
    // The seven layers and the body's own rows. Deeper than that is the leader
    // dots, which have nothing to gain from a plane of their own.
    maxDepth: 3,
  })

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

  // What the layers actually landed on, read back off the planes. The card
  // describes itself, so a change to the depth rules cannot leave it lying.
  const depths = useMemo(() => {
    const out = new Map<string, number>()
    for (const plane of handle?.planes ?? []) {
      const name = plane.el.dataset.layer
      if (name) out.set(name, plane.z)
    }
    return out
  }, [handle])

  if (!open) return null

  return (
    <div className="pxm" role="dialog" aria-modal="true" aria-label="About slopboard" onClick={close}>
      {/* Every class in here is static: delamin8r writes `dl-plane` onto these
          same elements, and React setting `className` would strip it. */}
      {/* Detached rather than tuned flat when the gate is off: a null ref tears
          the handle down, and the card's rows then read `·` instead of a Z that
          nothing is using. */}
      <div className="pxm__stage" ref={allowParallax ? ref : null}>
        <div className="pxm__deck" onClick={(e) => e.stopPropagation()}>
          <div className="pxm__layer pxm__starfield" data-layer="starfield" data-dl-lift="0" aria-hidden="true" />
          <div className="pxm__layer pxm__glow" data-layer="glow" data-dl-lift="1" aria-hidden="true" />
          <div className="pxm__layer pxm__wordmark" data-layer="wordmark" data-dl-lift="2" aria-hidden="true">
            SLOP
          </div>
          <div className="pxm__layer pxm__plate" data-layer="plate" data-dl-lift="3" aria-hidden="true" />
          <div className="pxm__layer pxm__body" data-layer="body" data-dl-lift="4">
            <p className="pxm__lede">
              Images land here and start dying. Nothing on the wall is archival — a render survives
              its time-to-live or it is rescued, and the pile forgets it either way.
            </p>
            <dl className="pxm__specs">
              {LAYERS.map((name) => (
                <div className="pxm__spec" key={name}>
                  <dt className="pxm__specName">{name}</dt>
                  <dd className="pxm__specZ">{depths.has(name) ? signed(depths.get(name) ?? 0) : '·'}</dd>
                </div>
              ))}
            </dl>
            <p className="pxm__hint">
              move the cursor — every row above sits on its own plane
              <span className="pxm__keys">esc</span>
            </p>
          </div>
          <div className="pxm__layer pxm__crest" data-layer="crest" data-dl-lift="5">
            <h2 className="pxm__title">SLOPBOARD</h2>
            <p className="pxm__sub">ephemeral render wall</p>
          </div>
          <div className="pxm__layer pxm__chip" data-layer="chip" data-dl-lift="6">
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
