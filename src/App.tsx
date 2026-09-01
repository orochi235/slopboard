import { useEffect, useState } from 'react'
import { useWall } from '@/useWall.ts'
import { arrangements } from '@/arrangements/index.ts'
import { DomBackend } from '@/backends/DomBackend.tsx'

export function App() {
  const { items, ttlMs, clockOffset, connected } = useWall()
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)
  const arrangement = arrangements[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' && e.key !== ']') return
      const step = e.key === ']' ? 1 : -1
      setIndex((i) => (i + step + arrangements.length) % arrangements.length)
      setFlash(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(false), 1200)
    return () => clearTimeout(id)
  }, [flash])

  return (
    <>
      <DomBackend
        items={items}
        arrangement={arrangement}
        ttlMs={ttlMs}
        clockOffset={clockOffset}
      />
      <div className={`hud ${flash ? 'hud--flash' : ''}`}>
        <span className="hud__name">{arrangement.name}</span>
        <span className="hud__count">{items.length}</span>
        {!connected && <span className="hud__offline">offline</span>}
      </div>
    </>
  )
}
