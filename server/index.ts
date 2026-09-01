import express from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import { createServer } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { config } from './config.ts'
import * as store from './store.ts'
import { watchInbox } from './ingest.ts'
import type { ServerMessage } from '@shared/protocol.ts'

await mkdir(config.inbox, { recursive: true })
await mkdir(config.cache, { recursive: true })

const app = express()
const http = createServer(app)
const wss = new WebSocketServer({ server: http, path: '/ws' })
const clients = new Set<WebSocket>()

function broadcast(msg: ServerMessage) {
  const payload = JSON.stringify(msg)
  for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(payload)
}

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  const hello: ServerMessage = {
    type: 'snapshot',
    now: Date.now(),
    ttlMs: config.ttlMs,
    items: store.snapshot(),
  }
  ws.send(JSON.stringify(hello))
})

app.get('/img/:id', (req, res) => {
  const path = store.resolveCache(req.params.id)
  if (!path) return void res.sendStatus(404)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  // dotfiles defaults to 'ignore', which 404s every path under ~/slop/.cache.
  res.sendFile(path, { dotfiles: 'allow' })
})

app.get('/orig/:id', (req, res) => {
  const path = store.resolveOriginal(req.params.id)
  if (!path) return void res.sendStatus(404)
  res.sendFile(path, { dotfiles: 'allow' })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, items: store.snapshot().length, ttlMs: config.ttlMs })
})

store.onExpire((id) => broadcast({ type: 'expire', id }))
store.startSweeper()
watchInbox((item) => {
  console.log(`[arrive] ${item.zone}/${item.id.slice(0, 8)} ${item.w}x${item.h}`)
  broadcast({ type: 'arrive', item })
})

http.listen(config.port, () => console.log(`[slopboard] :${config.port}`))
