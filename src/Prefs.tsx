import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { delaminate } from 'delamin8r'
import { ParamsBody } from '@/Params.tsx'
import { controlsOf } from '@/params.controls.ts'
import { categoriesFor } from '@/params.tabs.ts'
import type { StackParams } from '@/params.ts'
import { prefsTabs, resolveTab, stepTab, WALL } from '@/prefs.tabs.ts'
import { WallBody } from '@/WallBody.tsx'
import './prefs.css'

const TAB_KEY = 'slopboard.prefs.tab.v1'

const readTab = (): string | null => {
  try {
    return localStorage.getItem(TAB_KEY)
  } catch {
    return null
  }
}

/**
 * Preferences over the wall. The column down the left lists the surfaces —
 * params is the only one today — with six areas of the wall nested under it,
 * so the sheet shows one area at a time or the whole set in columns. The
 * controls are the corner panel's own, so the two cannot drift apart.
 */
export function Prefs({
  params,
  onChange,
  ttlMs,
  onTtl,
  onClose,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
  /** The wall's own lifetime, which lives on the daemon rather than in here. */
  ttlMs: number
  onTtl: (ms: number) => void
  onClose: () => void
}) {
  const tabs = useMemo(
    () => prefsTabs(categoriesFor(controlsOf(params).map((control) => control.path))),
    [params],
  )
  const [tabId, setTabId] = useState(() => resolveTab(tabs, readTab()).id)
  const tab = resolveTab(tabs, tabId)
  const sheet = useRef<HTMLDivElement>(null)
  const look = params.prefs

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab.id)
    } catch {
      // A refused store costs the sheet's memory of its tab, not the sheet.
    }
  }, [tab.id])

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

  // delamin8r reads its options once, so a tuning change unwraps the sheet and
  // wraps it again. `window`, not `tilt`: the sheet is a form, and a deck that
  // turns under the pointer moves what the hand is reaching for.
  useEffect(() => {
    const el = sheet.current
    if (!el || !look.parallax) return
    const handle = delaminate(el, {
      mode: 'window',
      step: look.step,
      swing: look.swing,
      // The head, the tab column and the body, then the tabs and the close.
      maxDepth: 2,
      // The body scrolls, and `overflow` flattens everything in it, so planes
      // there would only cost compositing and a warning each.
      skip: '.prefs__body > *',
    })
    if (import.meta.env.DEV) {
      for (const { el: flat, cause } of handle.diagnose()) console.warn(`[prefs] flat: ${cause}`, flat)
    }
    return () => handle.destroy()
  }, [look.parallax, look.step, look.swing])

  const onTabKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const delta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const next = stepTab(tabs, tab.id, delta)
    setTabId(next.id)
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus()
  }

  return (
    <div className="prefs" role="dialog" aria-modal="true" aria-label="Preferences" onClick={onClose}>
      {/* Classes in here are static and state rides on attributes: delamin8r
          writes `dl-plane` onto these elements, and React setting `className`
          strips it. */}
      <div className="prefs__sheet" ref={sheet} onClick={(e) => e.stopPropagation()}>
        <div className="prefs__head" data-dl-lift="1">
          <span className="prefs__title">preferences</span>
          <button type="button" className="prefs__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <nav
          className="prefs__side"
          role="tablist"
          aria-orientation="vertical"
          aria-label="Preference pages"
          data-dl-lift="0"
          onKeyDown={onTabKey}
        >
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              className="prefs__tab"
              data-tab={entry.id}
              data-depth={entry.depth}
              data-on={entry.id === tab.id ? '' : undefined}
              aria-selected={entry.id === tab.id}
              aria-controls="prefs-panel"
              tabIndex={entry.id === tab.id ? 0 : -1}
              onClick={() => setTabId(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <div
          className="prefs__body"
          id="prefs-panel"
          role="tabpanel"
          data-dl-lift="1"
        >
          {tab.id === WALL ? (
            <WallBody ttlMs={ttlMs} onTtl={onTtl} />
          ) : (
            <ParamsBody params={params} onChange={onChange} expanded only={tab.category} />
          )}
        </div>
      </div>
    </div>
  )
}
