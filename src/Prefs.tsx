import { useEffect } from 'react'
import { ParamsBody } from '@/Params.tsx'
import type { StackParams } from '@/params.ts'
import './prefs.css'

/**
 * Preferences over the wall. Today it holds the same controls as the corner
 * panel — the two share `ParamsBody` so they cannot drift — and the tab strip
 * is where the surfaces that are not parameters go, such as which repos report
 * to the wall.
 */
export function Prefs({
  params,
  onChange,
  onClose,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
  onClose: () => void
}) {
  // Capture, so Escape closes the dialog rather than reaching the wall's own
  // handler and walking a rung out of the hierarchy behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="prefs" role="dialog" aria-modal="true" aria-label="Preferences" onClick={onClose}>
      <div className="prefs__sheet" onClick={(e) => e.stopPropagation()}>
        <div className="prefs__tabs">
          <span className="prefs__tab prefs__tab--on">params</span>
          <button type="button" className="prefs__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="prefs__body">
          <ParamsBody params={params} onChange={onChange} expanded />
        </div>
      </div>
    </div>
  )
}
