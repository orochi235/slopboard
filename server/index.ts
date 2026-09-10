import express from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { config } from './config.ts'
import { classifyPortHolder } from './portGuard.ts'
import * as store from './store.ts'
import { watchInbox } from './ingest.ts'
import { watchZoneColors } from './zoneColors.ts'
import { zoneCounts } from './zoneCounts.ts'
import { alert, debugItem } from './alert.ts'
import { withKeyForwarder } from './page-keys.ts'
import { LEVELS, type Level } from '@shared/attention.ts'
import type { ServerMessage } from '@shared/protocol.ts'

await mkdir(config.inbox, { recursive: true })
await mkdir(config.cache, { recursive: true })

const app = express()
const http = createServer(app)
const wss = new WebSocketServer({ server: http, path: '/ws' })
const clients = new Set<WebSocket>()
let zoneColors: Record<string, string> = {}

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
    zoneColors,
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

// What the lightbox frames a page with, as opposed to what `/orig` hands to a
// save: the same bytes plus the forwarder that carries the wall's keys back
// out of a frame it cannot listen inside.
app.get('/page/:id', async (req, res) => {
  const item = store.snapshot().find((i) => i.id === req.params.id)
  const path = store.resolveOriginal(req.params.id)
  if (!path || item?.kind !== 'page') return void res.sendStatus(404)
  try {
    res.type('html').send(withKeyForwarder(await readFile(path, 'utf8')))
  } catch {
    res.sendStatus(404)
  }
})

// The only route that writes. A wall on a private machine, so the guard is
// that dismissing something already visible to the viewer costs nothing.
app.post('/api/items/:id/dismiss', async (req, res) => {
  const cleared = await store.dismiss(req.params.id)
  if (cleared) broadcast({ type: 'dismiss', id: req.params.id })
  res.json({ ok: true, cleared })
})

app.post('/api/items/:id/keep', async (req, res) => {
  const keptAt = await store.keep(req.params.id, req.query.on !== '0')
  if (keptAt !== false) broadcast({ type: 'keep', id: req.params.id, keptAt })
  res.json({ ok: keptAt !== false, keptAt: keptAt === false ? null : keptAt })
})

// The wall already takes everything eventually; this only says when. The
// broadcast is `expire`, the same message the sweeper sends, so a client
// cannot tell a hastened death from a natural one and needs no second path.
app.post('/api/items/:id/expire', async (req, res) => {
  const gone = await store.expireNow(req.params.id)
  if (gone) broadcast({ type: 'expire', id: req.params.id })
  res.json({ ok: gone })
})

app.post('/api/undo', async (_req, res) => {
  const items = await store.undoExpiry()
  for (const item of items) broadcast({ type: 'arrive', item })
  res.json({ ok: items.length > 0, restored: items.length })
})

// A whole zone, in one step. Guarded like the other writes — a wall on a
// private machine — and by the menu asking first, which is where the thinking
// happens: this is the one gesture that can take thirty artifacts at once.
app.post('/api/zones/:zone/expire', async (req, res) => {
  const ids = await store.expireZone(req.params.zone)
  for (const id of ids) broadcast({ type: 'expire', id })
  if (ids.length > 0) console.log(`[expire] zone ${req.params.zone} (${ids.length})`)
  res.json({ ok: ids.length > 0, expired: ids.length })
})

// Fires a level's whole treatment against an arrival that never happened, so
// the sound, the notification and the raise can be heard rather than reasoned
// about. Guarded like the dismiss route — a wall on a private machine — and by
// one thing more: the button that calls this is in the wall, so `clients.size`
// is never zero here and `raise` can only bring the window forward, never
// launch one.
app.post('/api/debug/alert/:level', (req, res) => {
  const level = req.params.level
  if (!(LEVELS as readonly string[]).includes(level))
    return void res.status(400).json({ ok: false, levels: LEVELS })
  const plan = alert(debugItem(level as Level), clients.size > 0)
  console.log(`[alert] debug ${level} ${JSON.stringify(plan)}`)
  res.json({ ok: true, level, plan })
})

app.get('/api/health', (_req, res) => {
  // The paths are here for anything that has to open a folder without being
  // told where the wall keeps its files — the menu bar widget, today.
  res.json({
    ok: true,
    items: store.snapshot().length,
    ttlMs: config.ttlMs,
    inbox: config.inbox,
    trash: config.trash,
  })
})

app.get('/api/zones', (_req, res) => {
  res.json({ zones: zoneCounts(store.snapshot()) })
})

watchZoneColors((colors) => {
  zoneColors = colors
  broadcast({ type: 'zoneColors', zoneColors: colors })
})

store.onExpire((id) => broadcast({ type: 'expire', id }))
store.startSweeper()
watchInbox((item) => {
  console.log(`[arrive] ${item.zone}/${item.id.slice(0, 8)} ${item.w}x${item.h}`)
  broadcast({ type: 'arrive', item })
  // After the broadcast: a wall that is already open should be showing the
  // artifact by the time anything asks the screen for attention on its behalf.
  const plan = alert(item, clients.size > 0)
  if (plan.sound || plan.notify || plan.raise !== 'none')
    console.log(`[alert] ${item.attention?.level} ${JSON.stringify(plan)}`)
})

let reportedListenError = false

// ws re-emits the http server's error on itself, so a handler on only one of
// them leaves the other copy unhandled — which throws.
const onListenError = (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') throw err
  if (reportedListenError) return
  reportedListenError = true
  void classifyPortHolder(config.port).then((holder) => {
    if (holder === 'slopboard') {
      console.log(`[slopboard] :${config.port} already serving, leaving it to run`)
      process.exit(0)
    }
    console.error(
      `[slopboard] port ${config.port} is held by something else. Set SLOP_PORT to use another.`,
    )
    process.exit(1)
  })
}

http.on('error', onListenError)
wss.on('error', onListenError)

http.listen(config.port, () => console.log(`[slopboard] :${config.port}`))
