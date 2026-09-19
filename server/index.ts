import express from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { config } from './config.ts'
import { classifyPortHolder } from './portGuard.ts'
import * as store from './store.ts'
import { watchInbox } from './ingest.ts'
import { watchZoneColors } from './zoneColors.ts'
import { readPins, setPinned } from './pins.ts'
import * as zones from './zones.ts'
import * as settings from './settings.ts'
import { zoneCounts } from './zoneCounts.ts'
import { alert, debugItem, toastFor } from './alert.ts'
import { withKeyForwarder } from './page-keys.ts'
import { LEVELS, type Level } from '@shared/attention.ts'
import { BEAT_MS, type ServerMessage } from '@shared/protocol.ts'

await settings.load()
await zones.load()
await mkdir(config.inbox, { recursive: true })
await mkdir(config.cache, { recursive: true })

const app = express()
const http = createServer(app)
const wss = new WebSocketServer({ server: http, path: '/ws' })
const clients = new Set<WebSocket>()
let zoneColors: Record<string, string> = {}
let pinnedZones: Record<string, number> = {}

function broadcast(msg: ServerMessage) {
  const payload = JSON.stringify(msg)
  for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(payload)
}

setInterval(() => broadcast({ type: 'beat' }), BEAT_MS).unref()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  const hello: ServerMessage = {
    type: 'snapshot',
    now: Date.now(),
    ttlMs: settings.ttlMs(),
    items: store.snapshot(),
    zoneColors,
    pinnedZones,
    zoneSettings: zones.all(),
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
  const cleared = await store.dismiss(req.params.id, req.query.question === 'close')
  const reply = store.replyOf(req.params.id)
  if (cleared && reply?.status === 'dismissed') broadcast({ type: 'reply', id: req.params.id, reply })
  else if (cleared) broadcast({ type: 'dismiss', id: req.params.id })
  res.json({ ok: true, cleared })
})

// Answers the question on a card. Where the agent offered choices, the answer
// has to be one of them: the agent branches on the exact string.
// How long an artifact lives when it carries no TTL of its own. The daemon's,
// not the browser's: it decides when a file moves to the trash.
app.post('/api/settings/ttl', express.json(), async (req, res) => {
  const ms = Number((req.body as { ms?: unknown } | undefined)?.ms)
  const held = await settings.setTtl(ms)
  if (held === null) return void res.status(400).json({ ok: false, ttlMs: settings.ttlMs() })
  console.log(`[settings] ttl ${held / 1000}s`)
  broadcast({ type: 'ttl', ttlMs: held })
  res.json({ ok: true, ttlMs: held })
})

app.post('/api/items/:id/answer', express.json(), async (req, res) => {
  const text = (req.body as { text?: unknown } | undefined)?.text
  const item = store.snapshot().find((i) => i.id === req.params.id)
  if (typeof text !== 'string' || text.trim() === '' || (item?.choices && !item.choices.includes(text)))
    return void res.status(400).json({ ok: false })
  const answered = await store.answer(req.params.id, 'answered', text)
  const reply = store.replyOf(req.params.id)
  if (answered && reply) broadcast({ type: 'reply', id: req.params.id, reply })
  res.json({ ok: answered })
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

// Whatever the OS would have opened the artifact with. The browser cannot
// call `open`, so the daemon does — and only ever on a path the store already
// holds, so the route cannot be pointed at an arbitrary file.
app.post('/api/items/:id/open', (req, res) => {
  const path = store.resolveOriginal(req.params.id)
  if (!path) return void res.sendStatus(404)
  spawn('open', [path], { stdio: 'ignore', detached: true }).unref()
  res.json({ ok: true })
})

app.post('/api/undo', async (_req, res) => {
  const items = await store.undoExpiry()
  for (const item of items) broadcast({ type: 'arrive', item })
  res.json({ ok: items.length > 0, restored: items.map((i) => i.id) })
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

// Holding a zone at the top, and letting it go. Reversible in one click, so
// unlike the expiry above it asks nothing first.
app.post('/api/zones/:zone/pin', async (req, res) => {
  const pinnedAt = await setPinned(req.params.zone, req.query.on !== '0')
  pinnedZones = await readPins()
  broadcast({ type: 'zonePin', zone: req.params.zone, pinnedAt })
  res.json({ ok: true, pinnedAt })
})

// What one zone overrides about itself: its color over the project's, its
// backdrop over the wall's, its lifetime over the wall's. A field sent as null
// goes back to inheriting. Guarded like the other writes — a wall on a private
// machine.
app.post('/api/zones/:zone/settings', express.json(), async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const field = <T>(key: string): T | null | undefined =>
    key in body ? (body[key] as T | null) : undefined
  const settings = await zones.set(req.params.zone, {
    color: field<string>('color'),
    backdrop: field<never>('backdrop'),
    ttlMs: field<number>('ttlMs'),
  })
  console.log(`[zone] ${req.params.zone} ${JSON.stringify(settings)}`)
  broadcast({ type: 'zoneSettings', zone: req.params.zone, settings })
  res.json({ ok: true, settings })
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
  const item = debugItem(level as Level)
  const plan = alert(item, clients.size > 0)
  const toast = toastFor(item, plan)
  if (toast) broadcast({ type: 'alert', alert: toast })
  console.log(`[alert] debug ${level} ${JSON.stringify(plan)}`)
  res.json({ ok: true, level, plan })
})

app.get('/api/health', (_req, res) => {
  // The paths are here for anything that has to open a folder without being
  // told where the wall keeps its files — the menu bar widget, today.
  res.json({
    ok: true,
    items: store.snapshot().length,
    ttlMs: settings.ttlMs(),
    inbox: config.inbox,
    trash: config.trash,
  })
})

app.get('/api/zones', (_req, res) => {
  res.json({ zones: zoneCounts(store.snapshot()) })
})

void readPins().then((pins) => {
  pinnedZones = pins
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
  const toast = toastFor(item, plan)
  if (toast) broadcast({ type: 'alert', alert: toast })
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
