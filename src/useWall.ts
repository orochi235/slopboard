import { useEffect, useRef, useState } from 'react'
import { ALERTS } from '@shared/attention.ts'
import { BEAT_MS, type ServerMessage, type WallItem } from '@shared/protocol.ts'
import { createWatchdog, type Watchdog } from '@/watchdog.ts'

export type Wall = {
  items: WallItem[]
  /** Zone to the colour of the project bound to it, where it has a `.hued`. */
  zoneColors: Record<string, string>
  /** The zones held at the top of the wall, each to when it was pinned. */
  pinnedZones: Record<string, number>
  ttlMs: number
  /** Add to Date.now() to get the daemon's clock. Keeps decay server-anchored. */
  clockOffset: number
  connected: boolean
  /** The last arrival whose level asks to be opened on sight. Held rather than
   *  fired so a wall that was closed does not open a queue of them at once —
   *  only the newest is still worth looking at. */
  announce: WallItem | null
}

export function useWall(): Wall {
  const [items, setItems] = useState<WallItem[]>([])
  const [zoneColors, setZoneColors] = useState<Record<string, string>>({})
  const [pinnedZones, setPinnedZones] = useState<Record<string, number>>({})
  const [ttlMs, setTtlMs] = useState(300_000)
  const [connected, setConnected] = useState(false)
  const [announce, setAnnounce] = useState<WallItem | null>(null)
  const clockOffset = useRef(0)

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
        } else if (msg.type === 'zoneColors') {
          setZoneColors(msg.zoneColors)
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
          // The item stays; only its flag and its question go.
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== msg.id) return i
              const { attention: _cleared, question: _closed, choices: _offered, ...rest } = i
              return rest
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
    ttlMs,
    clockOffset: clockOffset.current,
    connected,
    announce,
  }
}
