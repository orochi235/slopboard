import { BEAT_MS, type ServerMessage } from '@shared/protocol.ts'
import { createWatchdog, type Watchdog } from '@/watchdog.ts'

/** What the wall is told, and whether anything is telling it. `connected`
 *  turns true when the daemon has answered, not when a socket opens. */
export type Sink = {
  message: (msg: ServerMessage) => void
  connected: (on: boolean) => void
}

/** Where the wall's messages come from. Returns its own teardown. */
export type Transport = (sink: Sink) => () => void

/** The daemon over a WebSocket, reconnecting for as long as the wall is up. */
const live: Transport = ({ message, connected }) => {
  let socket: WebSocket | null = null
  let watchdog: Watchdog | null = null
  let retry: ReturnType<typeof setTimeout>
  let closed = false

  const retryLater = () => {
    connected(false)
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
      if (msg.type === 'snapshot') connected(true)
      message(msg)
    }
  }

  connect()
  return () => {
    closed = true
    clearTimeout(retry)
    watchdog?.stop()
    socket?.close()
  }
}

let current: Transport = live

/** Feeds the wall from something other than the daemon. The demo wall calls
 *  this once, before the first render. */
export const installTransport = (next: Transport) => {
  current = next
}

/** Read per call rather than bound once, so an install after module load
 *  still takes. */
export const subscribe: Transport = (sink) => current(sink)
