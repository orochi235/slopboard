import { useEffect, useState } from 'react'
import { arrangementsFor } from '@/arrangements/index.ts'
import { backendFrom } from '@/backend-flag.ts'
import { DomBackend } from '@/backends/DomBackend.tsx'
import { WebglBackend } from '@/backends/WebglBackend.tsx'
import { useWall } from '@/useWall.ts'

// Read once: one backend per window for its life, so a DOM wall and a 3D wall
// can run on two monitors at the same time.
const backend = backendFrom(location.search)
const available = arrangementsFor(backend === 'webgl' ? 3 : 2)

export function App() {
  const { items, ttlMs, clockOffset, connected } = useWall()
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' && e.key !== ']') return
      const step = e.key === ']' ? 1 : -1
      setIndex((i) => (i + step + available.length) % available.length)
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

  const arrangement = available[index]
  if (!arrangement) return null

  return (
    <>
      {arrangement.dims === 3 ? (
        <WebglBackend
          items={items}
          arrangement={arrangement}
          ttlMs={ttlMs}
          clockOffset={clockOffset}
        />
      ) : (
        <DomBackend
          items={items}
          arrangement={arrangement}
          ttlMs={ttlMs}
          clockOffset={clockOffset}
        />
      )}
      <div className={`hud ${flash ? 'hud--flash' : ''}`}>
        <span className="hud__name">{arrangement.name}</span>
        <span className="hud__count">{items.length}</span>
        {!connected && <span className="hud__offline">offline</span>}
      </div>
    </>
  )
}
