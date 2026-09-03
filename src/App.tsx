import { useEffect, useMemo, useState } from 'react'
import { createStack } from '@/arrangements/stack.ts'
import { arrangementsFor } from '@/arrangements/index.ts'
import { backendFrom } from '@/backend-flag.ts'
import { DomBackend } from '@/backends/DomBackend.tsx'
import { WebglBackend } from '@/backends/WebglBackend.tsx'
import { ParamsPanel } from '@/Params.tsx'
import { defaultParams } from '@/params.ts'
import { useWall } from '@/useWall.ts'

// Read once: one backend per window for its life, so a DOM wall and a 3D wall
// can run on two monitors at the same time.
const backend = backendFrom(location.search)
const available = arrangementsFor(backend === 'webgl' ? 3 : 2)

export function App() {
  const { items, ttlMs, clockOffset, connected } = useWall()
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)
  const [params, setParams] = useState(defaultParams)
  // createStack closes over its params, so a change rebuilds the arrangement.
  // Its rank allocators reset with it, which costs one frame of snapping —
  // the same contract every cache here already honours.
  const tuned = useMemo(() => createStack(params), [params])

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
          arrangement={arrangement.name === 'stack' ? tuned : arrangement}
          ttlMs={ttlMs}
          clockOffset={clockOffset}
          params={params}
        />
      ) : (
        <DomBackend
          items={items}
          arrangement={arrangement}
          ttlMs={ttlMs}
          clockOffset={clockOffset}
        />
      )}
      {backend === 'webgl' && <ParamsPanel params={params} onChange={setParams} />}
      <div className={`hud ${flash ? 'hud--flash' : ''}`}>
        <span className="hud__name">{arrangement.name}</span>
        <span className="hud__count">{items.length}</span>
        {!connected && <span className="hud__offline">offline</span>}
      </div>
    </>
  )
}
