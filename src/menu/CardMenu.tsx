import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReticule } from 'reticul8r/react'
import type { WallItem } from '@shared/protocol.ts'
import { menuFor, type Action, type Target } from '@/menu/items.ts'
import { placeMenu } from '@/menu/place.ts'
import './menu.css'

export type MenuAt = { target: Target; x: number; y: number }

/**
 * The right-click menu, as a DOM overlay over the canvas.
 *
 * `window` mode rather than `tilt`: the menu is anchored to the pointer and is
 * about to be clicked, and a deck that rotates moves every hit target out from
 * under the hand that opened it. Moving the viewpoint leaves the boxes where
 * they are and still parts the layers.
 */
export function CardMenu({
  at,
  item,
  canUndo,
  onAct,
  onClose,
}: {
  at: MenuAt
  item?: WallItem
  canUndo: boolean
  onAct: (action: Action) => void
  onClose: () => void
}) {
  const items = menuFor(at.target, { item, canUndo })
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const { ref, handle } = useReticule<HTMLDivElement>({ maxDepth: 3, swing: 14 })

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setSpot(
      placeMenu(at, { w: r.width, h: r.height }, { w: window.innerWidth, h: window.innerHeight }),
    )
    el.focus()
  }, [at])

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
      <div
        className={`menu ${spot ? 'menu--placed' : ''}`}
        ref={(node) => {
          box.current = node
          ref(node)
        }}
        style={spot ? { left: `${spot.left}px`, top: `${spot.top}px` } : undefined}
        role="menu"
        aria-label={at.target.kind === 'card' ? (item?.name ?? 'Card') : 'Wall'}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
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
            className={`menu__item ${entry.grave ? 'menu__item--grave' : ''} ${
              i === active ? 'menu__item--active' : ''
            }`}
            role="menuitem"
            tabIndex={-1}
            onPointerEnter={() => setActive(i)}
            onClick={() => onAct(entry.action)}
          >
            {entry.label}
          </div>
        ))}
      </div>
    </div>
  )
}
