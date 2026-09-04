import { useEffect, useRef, useState } from 'react'
import type { ServerMessage, WallItem } from '@shared/protocol.ts'

export type Wall = {
  items: WallItem[]
  /** Zone to the colour of the project bound to it, where it has a `.hued`. */
  zoneColors: Record<string, string>
  ttlMs: number
  /** Add to Date.now() to get the daemon's clock. Keeps decay server-anchored. */
  clockOffset: number
  connected: boolean
}

export function useWall(): Wall {
  const [items, setItems] = useState<WallItem[]>([])
  const [zoneColors, setZoneColors] = useState<Record<string, string>>({})
  const [ttlMs, setTtlMs] = useState(300_000)
  const [connected, setConnected] = useState(false)
  const clockOffset = useRef(0)

  useEffect(() => {
    let socket: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout>
    let closed = false

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${proto}://${location.host}/ws`)

      socket.onopen = () => setConnected(true)
      socket.onclose = () => {
        setConnected(false)
        if (!closed) retry = setTimeout(connect, 1000)
      }
      socket.onmessage = (ev) => {
        const msg: ServerMessage = JSON.parse(ev.data)
        if (msg.type === 'snapshot') {
          clockOffset.current = msg.now - Date.now()
          setTtlMs(msg.ttlMs)
          setItems(msg.items)
          setZoneColors(msg.zoneColors ?? {})
        } else if (msg.type === 'zoneColors') {
          setZoneColors(msg.zoneColors)
        } else if (msg.type === 'arrive') {
          setItems((prev) => [...prev, msg.item])
        } else if (msg.type === 'expire') {
          setItems((prev) => prev.filter((i) => i.id !== msg.id))
        }
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [])

  return { items, zoneColors, ttlMs, clockOffset: clockOffset.current, connected }
}
