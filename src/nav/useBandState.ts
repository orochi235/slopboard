import { useCallback, useEffect, useRef, useState } from 'react'
import { type BandState, loadBand, saveBand } from '@/nav/band-state.ts'

/** A patch, or one computed from what the band holds now — a toggle cannot be
 *  written any other way without reading stale state. */
type Patch = Partial<BandState> | ((was: BandState) => Partial<BandState>)

/**
 * The band's state, restored and written back whole. Whole is the point: every
 * control patches the one object, so a control added later is stored without
 * anyone remembering to store it.
 */
export function useBandState(): [BandState, (patch: Patch) => void] {
  // Lazy: reading storage on every render would be wasted.
  const [band, setBand] = useState(loadBand)
  // Only once something has actually changed. A mount write is what turns a
  // blob this build cannot read into a permanent loss.
  const loaded = useRef(band)
  useEffect(() => {
    if (band !== loaded.current) saveBand(band)
  }, [band])
  const patch = useCallback(
    (next: Patch) => setBand((was) => ({ ...was, ...(typeof next === 'function' ? next(was) : next) })),
    [],
  )
  return [band, patch]
}
