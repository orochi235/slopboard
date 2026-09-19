import { useCallback, useEffect, useRef, useState } from 'react'
import { ALERTS } from '@shared/attention.ts'
import { BEAT_MS, type Alert, type ServerMessage, type WallItem, type ZoneSettings } from '@shared/protocol.ts'
import { createWatchdog, type Watchdog } from '@/watchdog.ts'

/** One write to a zone's overrides. A field left out is untouched; a field
 *  passed as null goes back to inheriting the wall's. */
export type ZonePatch = {
  color?: string | null
  backdrop?: ZoneSettings['backdrop'] | null
  ttlMs?: number | null
}

export type Wall = {
  items: WallItem[]
  /** Zone to the colour of the project bound to it, where it has a `.hued`. */
  zoneColors: Record<string, string>
  /** The zones held at the top of the wall, each to when it was pinned. */
  pinnedZones: Record<string, number>
  /** What each zone overrides about itself. Most zones have no entry. */
  zoneSettings: Record<string, ZoneSettings>
  /** Sets one zone's overrides. A field passed as null goes back to
   *  inheriting; a field left out is untouched. Nothing is held optimistically
   *  — the daemon answers with the message every wall reads. */
  setZoneSettings: (zone: string, patch: ZonePatch) => void
  ttlMs: number
  /** Sets how long an artifact lives from now on. The daemon answers with the
   *  `ttl` message every wall reads, so nothing is held optimistically here. */
  setTtlMs: (ms: number) => void
  /** Add to Date.now() to get the daemon's clock. Keeps decay server-anchored. */
  clockOffset: number
  connected: boolean
  /** The last arrival whose level asks to be opened on sight. Held rather than
   *  fired so a wall that was closed does not open a queue of them at once —
   *  only the newest is still worth looking at. */
  announce: WallItem | null
  /** Sounds the daemon has played that the wall has not yet explained, oldest
   *  first. A toast exists for as long as its entry does. */
  alerts: Alert[]
  dismissAlert: (id: string) => void
}

/** More than this and the newest sound is what matters; the rest have been
 *  heard and not read, and a column of them explains nothing. */
const ALERTS_SHOWN = 4

export function useWall(): Wall {
  const [items, setItems] = useState<WallItem[]>([])
  const [zoneColors, setZoneColors] = useState<Record<string, string>>({})
  const [pinnedZones, setPinnedZones] = useState<Record<string, number>>({})
  const [zoneSettings, holdZoneSettings] = useState<Record<string, ZoneSettings>>({})
  const [ttlMs, setTtlMs] = useState(300_000)
  const [connected, setConnected] = useState(false)
  const [announce, setAnnounce] = useState<WallItem | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const clockOffset = useRef(0)
  const dismissAlert = useCallback(
    (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id)),
    [],
  )

  const postZone = useCallback((zone: string, patch: ZonePatch) => {
    void fetch(`/api/zones/${encodeURIComponent(zone)}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }, [])

  const postTtl = useCallback((ms: number) => {
    void fetch('/api/settings/ttl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ms }),
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let socket: WebSocket | null = null
    let watchdog: Watchdog | null = null
    let retry: ReturnType<typeof setTimeout>
    let closed = false

    const retryLater = () => {
      setConnected(false)
      if (!closed) retry = setTimeout(connect, 1000)
    }

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      socket = ws

      // A daemon that dies behind vite's proxy can leave this end open and
      // quiet, so silence has to count as a close.
      const dog = createWatchdog(BEAT_MS * 3, () => {
        ws.onclose = null
        ws.onmessage = null
        ws.close()
        retryLater()
      })
      watchdog = dog

      ws.onclose = () => {
        dog.stop()
        retryLater()
      }
      ws.onmessage = (ev) => {
        dog.feed()
        const msg: ServerMessage = JSON.parse(ev.data)
        if (msg.type === 'snapshot') {
          // Connected once the daemon has answered, not when a socket opens.
          setConnected(true)
          clockOffset.current = msg.now - Date.now()
          setTtlMs(msg.ttlMs)
          setItems(msg.items)
          setZoneColors(msg.zoneColors ?? {})
          setPinnedZones(msg.pinnedZones ?? {})
          holdZoneSettings(msg.zoneSettings ?? {})
        } else if (msg.type === 'ttl') {
          setTtlMs(msg.ttlMs)
        } else if (msg.type === 'zoneColors') {
          setZoneColors(msg.zoneColors)
        } else if (msg.type === 'zoneSettings') {
          holdZoneSettings((prev) => {
            // A zone back to inheriting everything leaves no entry, the shape
            // the snapshot has: `zoneSettings[zone]` is absent, never empty.
            if (Object.keys(msg.settings).length === 0) {
              const { [msg.zone]: _inherits, ...rest } = prev
              return rest
            }
            return { ...prev, [msg.zone]: msg.settings }
          })
        } else if (msg.type === 'zonePin') {
          setPinnedZones((prev) => {
            if (msg.pinnedAt === null) {
              const { [msg.zone]: _released, ...rest } = prev
              return rest
            }
            return { ...prev, [msg.zone]: msg.pinnedAt }
          })
        } else if (msg.type === 'arrive') {
          setItems((prev) => [...prev, msg.item])
          const level = msg.item.attention?.level
          if (level && ALERTS[level].lightbox) setAnnounce(msg.item)
        } else if (msg.type === 'alert') {
          setAlerts((prev) => [...prev.filter((a) => a.id !== msg.alert.id), msg.alert].slice(-ALERTS_SHOWN))
        } else if (msg.type === 'expire') {
          setItems((prev) => prev.filter((i) => i.id !== msg.id))
        } else if (msg.type === 'keep') {
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== msg.id) return i
              if (msg.keptAt === null) {
                const { keptAt: _released, ...rest } = i
                return rest
              }
              return { ...i, keptAt: msg.keptAt }
            }),
          )
        } else if (msg.type === 'dismiss') {
          // The item stays; only its flag goes.
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== msg.id) return i
              const { attention: _cleared, ...rest } = i
              return rest
            }),
          )
        } else if (msg.type === 'reply') {
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== msg.id) return i
              const { attention: _cleared, ...rest } = i
              return { ...rest, reply: msg.reply }
            }),
          )
        }
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      watchdog?.stop()
      socket?.close()
    }
  }, [])

  return {
    items,
    zoneColors,
    pinnedZones,
    zoneSettings,
    setZoneSettings: postZone,
    ttlMs,
    setTtlMs: postTtl,
    clockOffset: clockOffset.current,
    connected,
    announce,
    alerts,
    dismissAlert,
  }
}
