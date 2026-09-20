import { useEffect, useMemo, useRef, useState } from 'react'
import { createStack } from '@/arrangements/stack.ts'
import { actions } from '@/actions.ts'
import { agree } from '@shared/build.ts'
import { arrangements } from '@/arrangements/index.ts'
import { WebglBackend } from '@/backends/WebglBackend.tsx'
import { ParallaxModal } from '@/ParallaxModal.tsx'
import { Prefs } from '@/Prefs.tsx'
import { ZoneConfig } from '@/ZoneConfig.tsx'
import { layoutKeyOf } from '@/params.layout.ts'
import { defaultParams } from '@/params.ts'
import { loadParams, saveParams } from '@/params.store.ts'
import { Toasts } from '@/Toasts.tsx'
import { applyColors } from '@/theme.ts'
import { stackFor } from '@/typeface.ts'
import { useWall } from '@/useWall.ts'
import { tintsFor } from '@/zone-settings.ts'


export function App() {
  const {
    items,
    zoneColors,
    pinnedZones,
    zoneSettings,
    setZoneSettings,
    ttlMs,
    setTtlMs,
    clockOffset,
    connected,
    daemonBuild,
    announce,
    alerts,
    dismissAlert,
  } = useWall()
  const [index, setIndex] = useState(0)
  const [prefs, setPrefs] = useState(false)
  /** The zone whose own sheet is open, or null. */
  const [configuring, setConfiguring] = useState<string | null>(null)
  // A zone's own color over the project's, so everything below reads one map
  // and never learns there is an override.
  const tints = useMemo(() => tintsFor(zoneColors, zoneSettings), [zoneColors, zoneSettings])
  // Lazy: reading storage on every render would be wasted, and the tuning
  // pass is the whole reason the panel exists — losing it on reload defeats it.
  const [params, setParams] = useState(() => loadParams(defaultParams))
  // createStack closes over its params, so a change rebuilds the arrangement
  // and resets its rank allocators — one frame of snapping, the same contract
  // every cache here already honors. Keyed on the layout half alone so that
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
    if (params !== loaded.current) saveParams(params)
  }, [params])

  useEffect(() => {
    applyColors(params.colors, document.documentElement)
  }, [params.colors])

  useEffect(() => {
    document.documentElement.style.setProperty('--chrome-face', stackFor(params.typeface.chrome))
  }, [params.typeface.chrome])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Chrome opens its own settings on ⌘, unless the page cancels it first.
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        return setPrefs((open) => !open)
      }
      if (e.key !== '[' && e.key !== ']') return
      const step = e.key === ']' ? 1 : -1
      setIndex((i) => (i + step + arrangements.length) % arrangements.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const arrangement = arrangements[index]
  if (!arrangement) return null

  return (
    <>
      <WebglBackend
        items={items}
        arrangement={arrangement.name === 'stack' ? tuned : arrangement}
        ttlMs={ttlMs}
        clockOffset={clockOffset}
        params={params}
        onParams={setParams}
        zoneColors={tints}
        pinnedZones={pinnedZones}
        zoneSettings={zoneSettings}
        onConfigureZone={setConfiguring}
        onPrefs={() => setPrefs(true)}
        announce={announce}
        connected={connected}
        stale={daemonBuild !== null && !agree(daemonBuild, __SLOP_BUILD__)}
      />
      <ParallaxModal allowParallax={params.general.parallax} />
      <Toasts alerts={alerts} onDismiss={dismissAlert} />
      {configuring !== null && (
        <ZoneConfig
          zone={configuring}
          settings={zoneSettings[configuring] ?? {}}
          hued={zoneColors[configuring]}
          count={items.filter((i) => i.zone === configuring).length}
          pinned={configuring in pinnedZones}
          wall={{
            backdrop: params.zones.backdrop,
            hatchSpacing: params.zones.hatchSpacing,
            hatchPeriod: params.zones.hatchPeriod,
            hatchAngleDeg: params.zones.hatchAngleDeg,
            ttlMs,
          }}
          look={params.prefs}
          allowParallax={params.general.parallax}
          onChange={(patch) => setZoneSettings(configuring, patch)}
          onPin={(on) => actions.pinZone(configuring, on)}
          onExpire={() => {
            actions.expireZone(configuring)
            setConfiguring(null)
          }}
          onClose={() => setConfiguring(null)}
        />
      )}
      {prefs && (
        <Prefs
          params={params}
          onChange={setParams}
          ttlMs={ttlMs}
          onTtl={setTtlMs}
          onClose={() => setPrefs(false)}
        />
      )}
    </>
  )
}
