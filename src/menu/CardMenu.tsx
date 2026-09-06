import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReticule } from 'reticul8r/react'
import type { WallItem } from '@shared/protocol.ts'
import { menuFor, type Action, type Target } from '@/menu/items.ts'
import type { StackParams } from '@/params.ts'
import { placeMenu } from '@/menu/place.ts'
import './menu.css'

export type MenuAt = { target: Target; x: number; y: number }

/**
 * The right-click menu, as a DOM overlay over the canvas.
 *
 * Every class in here is static, and state rides on `data-` attributes:
 * reticul8r writes `rz-plane` onto these same elements, and React setting
 * `className` replaces the whole attribute, which would strip it. A row that
 * loses `rz-plane` stops moving and snaps back to its unscaled size.
 */
export function CardMenu({
  at,
  item,
  canUndo,
  look,
  onAct,
  onClose,
}: {
  at: MenuAt
  item?: WallItem
  canUndo: boolean
  look: StackParams['menu']
  onAct: (action: Action) => void
  onClose: () => void
}) {
  const items = menuFor(at.target, { item, canUndo })
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const { ref, handle } = useReticule<HTMLDivElement>({
    mode: look.mode,
    fan: look.fan,
    step: look.step,
    swing: look.swing,
    tilt: look.tilt,
    maxDepth: 4,
  })
  // One stable function, not an inline arrow: React detaches and reattaches a
  // ref whose identity changed, `useReticule` sets state on every attach, and
  // that is an infinite render loop rather than a slow one.
  const hold = useCallback(
    (node: HTMLDivElement | null) => {
      box.current = node
      ref(node)
    },
    [ref],
  )

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setSpot(
      placeMenu(at, { w: r.width, h: r.height }, { w: window.innerWidth, h: window.innerHeight }),
    )
    el.querySelector<HTMLElement>('.menu__deck')?.focus()
  }, [at])

  // reticul8r measures every row to cancel perspective magnification, and the
  // ref attaches while the menu is still at the pointer's top-left waiting to
  // be placed. Re-read once it has moved, or the first thing that recomputes
  // does it against the real rect and every row changes size at once.
  useLayoutEffect(() => {
    if (spot) handle?.refresh()
  }, [handle, spot])

  // The wall's own keys are bound to the window, so the menu takes what it
  // needs on the way down or the arrows steer the camera behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        return onClose()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const step = e.key === 'ArrowDown' ? 1 : -1
        return setActive((i) => (i + step + items.length) % items.length)
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        const chosen = items[active]
        if (chosen) onAct(chosen.action)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [items, active, onAct, onClose])

  // A plane an ancestor has flattened still reports `preserve-3d`, so the only
  // way this is ever noticed is by asking.
  useEffect(() => {
    if (!import.meta.env.DEV || !handle) return
    for (const { el, cause } of handle.diagnose()) console.warn(`[menu] flat: ${cause}`, el)
  }, [handle])

  if (items.length === 0) return null

  return (
    <div className="menu__scrim" onPointerDown={onClose} onContextMenu={(e) => e.preventDefault()}>
      {/* Two elements, because `tilt` rotates a deck *inside* the container:
          the shell holds the position and the perspective and never turns, and
          the deck is the surface you can see move. */}
      <div
        className="menu"
        data-placed={spot ? '' : undefined}
        ref={hold}
        style={spot ? { left: `${spot.left}px`, top: `${spot.top}px` } : undefined}
        onPointerDown={(e) => e.stopPropagation()}
      >
       <div
         className="menu__deck"
         role="menu"
         aria-label={at.target.kind === 'card' ? (item?.name ?? 'Card') : 'Wall'}
         tabIndex={-1}
       >
        {at.target.kind !== 'sky' && (
          <div className="menu__head">
            <span className="menu__zone">{'zone' in at.target ? at.target.zone : ''}</span>
            {item?.name && <span className="menu__name">{item.name}</span>}
          </div>
        )}
        {items.map((entry, i) => (
          <div
            key={entry.action}
            className={entry.grave ? 'menu__item menu__item--grave' : 'menu__item'}
            data-active={i === active ? '' : undefined}
            role="menuitem"
            tabIndex={-1}
            onPointerEnter={() => setActive(i)}
            onClick={() => onAct(entry.action)}
          >
            {/* The row is the plane the highlight paints on; the label is
                lifted clear of it. Depth in reticul8r only runs toward the
                viewer, so the way to put the highlight behind the text is to
                bring the text forward. */}
            <span className="menu__label" data-rz-lift="1">
              {entry.label}
            </span>
          </div>
        ))}
       </div>
      </div>
    </div>
  )
}
