import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { delaminate } from 'delamin8r'
import { ParamsBody } from '@/Params.tsx'
import { controlsOf } from '@/params.controls.ts'
import { categoriesFor } from '@/params.tabs.ts'
import type { StackParams } from '@/params.ts'
import { GENERAL, prefsTabs, resolveTab, stepTab } from '@/prefs.tabs.ts'
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
  const stage = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(false)
  const look = params.prefs

  // Whether this area needs the scroller at all. Only `params` — every group
  // at once — overflows, and it overflows sideways, since a multicol box with
  // a fixed height spills into more columns rather than down the page.
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    const measure = () =>
      setFits(el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)
    measure()
    // The children too: a group folds and unfolds under the pointer, and the
    // body's own box never changes when it does.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of el.children) ro.observe(child)
    return () => ro.disconnect()
  }, [tab.id])

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

  // delamin8r reads its options once, so a tuning change unwraps the modal and
  // wraps it again. `window`, not `tilt`: the sheet is a form, and a deck that
  // turns under the pointer moves what the hand is reaching for.
  //
  // The stage is the scrim, not the sheet. A stage never moves, so staging the
  // sheet left its own border as the only reference the eye had, and a border
  // is where the motion is smallest; against the wall showing through the
  // scrim, the sheet has something with detail in it to move against.
  const parallax = params.general.parallax && look.parallax

  useEffect(() => {
    const el = stage.current
    if (!el || !parallax) return
    const handle = delaminate(el, {
      mode: 'window',
      step: look.step,
      perspective: look.perspective,
      swing: look.swing,
      // The sheet, then the head, the tab column and the body, then the tabs,
      // the close and the body's own group cards.
      maxDepth: 3,
      // Window mode moves the planes against the pointer and drift moves them
      // with it, so the default 0.05 does not add to the parallax, it cancels
      // it — and at any sane Z it wins.
      drift: false,
      // While the body scrolls, `overflow` flattens everything in it, so planes
      // there would only cost compositing and a warning each.
      skip: fits ? undefined : '.prefs__body > *',
    })
    if (import.meta.env.DEV) {
      for (const { el: flat, cause } of handle.diagnose()) console.warn(`[prefs] flat: ${cause}`, flat)
    }
    return () => handle.destroy()
  }, [parallax, look.step, look.perspective, look.swing, fits])

  const onTabKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const delta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (delta === 0) return
    e.preventDefault()
    const next = stepTab(tabs, tab.id, delta)
    setTabId(next.id)
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus()
  }

  return (
    <div
      className="prefs"
      role="dialog"
      aria-modal="true"
      aria-label="Preferences"
      ref={stage}
      onClick={onClose}
    >
      {/* Classes in here are static and state rides on attributes: delamin8r
          writes `dl-plane` onto these elements, and React setting `className`
          strips it. */}
      <div className="prefs__sheet" onClick={(e) => e.stopPropagation()}>
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
          ref={body}
          data-dl-lift="1"
          data-fits={fits ? '' : undefined}
        >
          {tab.id === GENERAL && <WallBody ttlMs={ttlMs} onTtl={onTtl} />}
          <ParamsBody params={params} onChange={onChange} expanded only={tab.category} />
        </div>
      </div>
    </div>
  )
}
