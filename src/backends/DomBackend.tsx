import { useEffect, useRef } from 'react'
import type { WallItem } from '@shared/protocol.ts'
import type { Arrangement2D, Item, Placement } from '@/arrangements/index.ts'

type Props = {
  items: WallItem[]
  arrangement: Arrangement2D
  ttlMs: number
  clockOffset: number
}

function write(el: HTMLElement, p: Placement, shortEdge: number, aspect: number) {
  const side = p.scale * shortEdge
  const w = aspect >= 1 ? side : side * aspect
  const h = aspect >= 1 ? side / aspect : side
  el.style.setProperty('--w', `${w}px`)
  el.style.setProperty('--h', `${h}px`)
  el.style.setProperty('--x', `${p.x * window.innerWidth}px`)
  el.style.setProperty('--y', `${p.y * window.innerHeight}px`)
  el.style.setProperty('--o', String(p.opacity))
  el.style.setProperty('--z', String(Math.round((1 - p.depth) * 1000)))
  el.style.setProperty('--blur', `${p.blur ?? 0}px`)
  el.style.setProperty('--sat', String(p.saturation ?? 1))
}

export function DomBackend({ items, arrangement, ttlMs, clockOffset }: Props) {
  const nodes = useRef(new Map<string, HTMLElement>())
  const latest = useRef({ items, arrangement, ttlMs, clockOffset })
  latest.current = { items, arrangement, ttlMs, clockOffset }

  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (document.hidden) return

      const { items, arrangement, ttlMs, clockOffset } = latest.current
      const now = Date.now() + clockOffset
      const viewport = { w: window.innerWidth, h: window.innerHeight }
      const shortEdge = Math.min(viewport.w, viewport.h)

      const model: Item[] = items.map((i) => ({
        id: i.id,
        aspect: i.w / i.h,
        age01: Math.min(1, (now - i.bornAt) / ttlMs),
        zone: i.zone,
        pinned: false,
        hovered: false,
      }))
      const aspects = new Map(model.map((m) => [m.id, m.aspect]))

      for (const p of arrangement.arrange(model, viewport, now)) {
        const el = nodes.current.get(p.id)
        if (el) write(el, p, shortEdge, aspects.get(p.id) ?? 1)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="wall">
      {items.map((item) => (
        <div
          key={item.id}
          className="slop-item"
          ref={(el) => {
            if (el) nodes.current.set(item.id, el)
            else nodes.current.delete(item.id)
          }}
        >
          <img src={item.url} alt="" loading="eager" decoding="async" />
        </div>
      ))}
    </div>
  )
}
