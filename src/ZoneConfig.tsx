import { useEffect, useRef, useState } from 'react'
import { CheckboxRow, ColorRow, PropertyList, SelectRow } from '@weasel-js/ui'
import { delaminate } from 'delamin8r'
import { BACKDROPS, type Backdrop } from '@shared/backdrops.ts'
import type { ZoneSettings } from '@shared/protocol.ts'
import type { StackParams } from '@/params.ts'
import type { ZonePatch } from '@/useWall.ts'
import { ttlOptions } from '@/wall-settings.ts'
import './zone-config.css'

/** What a row shows for a field the zone has not set. Empty rather than a
 *  word of its own, so the option list never collides with a pattern name. */
const INHERIT = ''

const inheritLabel = (what: string) => `the wall's (${what})`

export function ZoneConfig({
  zone,
  settings,
  hued,
  count,
  pinned,
  wall,
  look,
  allowParallax,
  onChange,
  onPin,
  onExpire,
  onClose,
}: {
  zone: string
  /** What this zone overrides today. Empty for one that inherits everything. */
  settings: ZoneSettings
  /** The color the daemon read off the project's `.hued`, where it found one.
   *  What clearing the override goes back to. */
  hued?: string
  /** How many artifacts the zone holds, so the last row says what it costs. */
  count: number
  pinned: boolean
  /** The defaults this zone is overriding, for the rows that say so. */
  wall: { backdrop: Backdrop; ttlMs: number }
  look: StackParams['prefs']
  /** The app-wide parallax gate. The sheet has no flag of its own. */
  allowParallax: boolean
  onChange: (patch: ZonePatch) => void
  onPin: (on: boolean) => void
  onExpire: () => void
  onClose: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  /** The expire row, clicked once and waiting to be meant. The menu asks the
   *  same question the same way. */
  const [armed, setArmed] = useState(false)

  // Capture, so Escape closes the sheet rather than reaching the wall's own
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

  // The stage is the scrim and the mode is `window`, both for the reason the
  // prefs sheet gives: this is a form, and a deck that turns under the pointer
  // moves what the hand is reaching for.
  const parallax = allowParallax && look.parallax
  useEffect(() => {
    const el = stage.current
    if (!el || !parallax) return
    const handle = delaminate(el, {
      mode: 'window',
      step: look.step,
      perspective: look.perspective,
      swing: look.swing,
      // The sheet, then its head and body. No deeper: the rows are controls,
      // and a control on a plane of its own is one the pointer has to chase.
      maxDepth: 2,
      drift: false,
    })
    return () => handle.destroy()
  }, [parallax, look.step, look.perspective, look.swing])

  return (
    <div
      className="zcfg"
      role="dialog"
      aria-modal="true"
      aria-label={`Configure ${zone}`}
      ref={stage}
      onClick={onClose}
    >
      {/* Classes in here are static and state rides on attributes: delamin8r
          writes `dl-plane` onto these elements, and React setting `className`
          strips it. */}
      <div className="zcfg__sheet wzl-skin" onClick={(e) => e.stopPropagation()}>
        <div className="zcfg__head" data-dl-lift="1">
          <span className="zcfg__title">{zone}</span>
          <button type="button" className="zcfg__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="zcfg__body" data-dl-lift="1">
          <PropertyList>
            <ColorRow
              label="color"
              value={settings.color ?? hued ?? '#888888'}
              onChange={(next) => onChange({ color: next })}
            />
            <SelectRow
              label="backdrop"
              layout="inline"
              value={settings.backdrop ?? INHERIT}
              options={[
                { value: INHERIT, label: inheritLabel(wall.backdrop) },
                ...BACKDROPS.map((name) => ({ value: name, label: name })),
              ]}
              onChange={(raw) => onChange({ backdrop: raw === INHERIT ? null : (raw as Backdrop) })}
            />
            <SelectRow
              label="lifetime"
              layout="inline"
              value={settings.ttlMs === undefined ? INHERIT : String(settings.ttlMs)}
              options={[
                {
                  value: INHERIT,
                  label: inheritLabel(
                    ttlOptions(wall.ttlMs).find((o) => o.value === String(wall.ttlMs))?.label ?? '',
                  ),
                },
                ...ttlOptions(settings.ttlMs ?? wall.ttlMs),
              ]}
              onChange={(raw) => {
                if (raw === INHERIT) return onChange({ ttlMs: null })
                const ms = Number(raw)
                if (Number.isFinite(ms)) onChange({ ttlMs: ms })
              }}
            />
            <CheckboxRow label="pinned to the top" value={pinned} onChange={onPin} />
          </PropertyList>

          {settings.color !== undefined && (
            <button
              type="button"
              className="zcfg__button"
              onClick={() => onChange({ color: null })}
            >
              {hued ? "use the project's color" : 'use the wall palette'}
            </button>
          )}

          <p className="zcfg__note">
            Set on the daemon, so every wall sees it and it survives a restart. A lifetime here
            takes what is already hanging in the zone, not only what lands next.
          </p>
        </div>
        <div className="zcfg__foot" data-dl-lift="1">
          {/* Two clicks, like the menu's: this is the one control here that can
              take thirty artifacts at once. */}
          <button
            type="button"
            className="zcfg__button zcfg__button--grave"
            data-armed={armed ? '' : undefined}
            onClick={() => {
              if (!armed) return setArmed(true)
              setArmed(false)
              onExpire()
            }}
          >
            {armed ? `Really — expire ${count}` : `Expire everything (${count})`}
          </button>
        </div>
      </div>
    </div>
  )
}
