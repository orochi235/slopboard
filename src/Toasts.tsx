import { useEffect } from 'react'
import type { Alert } from '@shared/protocol.ts'
import './toasts.css'

/** Long enough to read across the room; the sound was the interruption, and
 *  the toast only has to outlast the question "what was that?". */
const SHOW_MS = 12_000

/**
 * Why the wall just made a noise: one card per sound the daemon reports, with
 * the zone it landed in, the level that earned the sound, and the note or
 * question it wants read. Clicking one walks to the card.
 */
export function Toasts({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  const newest = alerts[alerts.length - 1]?.id
  useEffect(() => {
    if (!newest) return
    const timer = setTimeout(() => onDismiss(newest), SHOW_MS)
    return () => clearTimeout(timer)
  }, [newest, onDismiss])

  if (alerts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {alerts.map((alert) => (
        <div key={alert.id} className="toast" data-level={alert.level}>
          <a
            className="toast__body"
            href={`#/${alert.zone}/${alert.id}`}
            onClick={() => onDismiss(alert.id)}
          >
            <div className="toast__from">
              <span className="toast__zone">{alert.zone}</span>
              <span className="toast__level">{alert.level}</span>
              {alert.repo && (
                <span className="toast__repo">
                  {alert.repo}
                  {alert.sha ? `@${alert.sha}` : ''}
                </span>
              )}
            </div>
            <div className="toast__asks">{alert.asks}</div>
          </a>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss"
            onClick={() => onDismiss(alert.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
