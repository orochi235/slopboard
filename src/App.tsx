import { useEffect, useMemo, useRef, useState } from 'react'
import { createStack } from '@/arrangements/stack.ts'
import { arrangementsFor } from '@/arrangements/index.ts'
import { backendFrom } from '@/backend-flag.ts'
import { DomBackend } from '@/backends/DomBackend.tsx'
import { WebglBackend } from '@/backends/WebglBackend.tsx'
import { ParamsPanel } from '@/Params.tsx'
import { Prefs } from '@/Prefs.tsx'
import { layoutKeyOf } from '@/params.layout.ts'
import { defaultParams } from '@/params.ts'
import { loadParams, saveParams } from '@/params.store.ts'
import { applyColors } from '@/theme.ts'
import { useWall } from '@/useWall.ts'

// Read once: one backend per window for its life, so a DOM wall and a 3D wall
// can run on two monitors at the same time.
const backend = backendFrom(location.search)
const available = arrangementsFor(backend === 'webgl' ? 3 : 2)

export function App() {
  const { items, zoneColors, ttlMs, clockOffset, connected } = useWall()
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)
  const [prefs, setPrefs] = useState(false)
  // Lazy: reading storage on every render would be wasted, and the tuning
  // pass is the whole reason the panel exists — losing it on reload defeats it.
  const [params, setParams] = useState(() => loadParams(defaultParams))
  // createStack closes over its params, so a change rebuilds the arrangement
  // and resets its rank allocators — one frame of snapping, the same contract
  // every cache here already honours. Keyed on the layout half alone so that
  // turning the camera, which no strategy reads, does not reshuffle the piles.
  const layoutKey = layoutKeyOf(params)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutKey is params, minus the display half
  const tuned = useMemo(() => createStack(params), [layoutKey])

  // Only a tab that can edit writes, and only once it actually has. A mount
  // write is what turns a read this build cannot parse into a permanent loss:
  // loadParams falls back to the defaults, and the effect then saves them over
  // the stored set. A second wall on another monitor no longer clobbers the
  // tuned one either, since it has no panel to tune with.
  const loaded = useRef(params)
  useEffect(() => {
    if (backend === 'webgl' && params !== loaded.current) saveParams(params)
  }, [params])

  useEffect(() => {
    applyColors(params.colors, document.documentElement)
  }, [params.colors])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The usual key for preferences, and one the wall does not otherwise use.
      if (e.key === ',') return setPrefs((open) => !open)
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
          onParams={setParams}
          zoneColors={zoneColors}
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
      {prefs && <Prefs params={params} onChange={setParams} onClose={() => setPrefs(false)} />}
      <div className={`hud ${flash ? 'hud--flash' : ''}`}>
        <span className="hud__name">{arrangement.name}</span>
        <span className="hud__count">{items.length}</span>
        {!connected && <span className="hud__offline">offline</span>}
      </div>
    </>
  )
}
