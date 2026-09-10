/** Reads what tools/flicker-matrix.mjs wrote and prints a hold-by-hold table. */
import { readFileSync } from 'node:fs'
import { OUT } from './flicker-wall.mjs'

const { frames, marks, durs } = JSON.parse(readFileSync(`${OUT}/frames.json`))

const holds = []
for (const [ts, name] of marks) {
  if (name.startsWith('COND_START_')) holds.push({ name: name.slice(11), from: ts })
  else holds[holds.length - 1].to = ts
}
const find = (ts) => holds.find((h) => ts >= h.from && ts <= h.to)

const rows = {}
for (const h of holds) rows[h.name] = { all: 0, dropped: 0, missing: 0, checker: 0, hiLat: 0, d: {} }
for (const [ts, state, missing, checker, hiLat] of frames) {
  const h = find(ts)
  if (!h) continue
  const r = rows[h.name]
  if (state === 'STATE_PRESENTED_ALL') r.all++
  else if (state === 'STATE_DROPPED') r.dropped++
  r.missing += missing
  r.checker += checker
  r.hiLat += hiLat
}
for (const [ts, name, dur] of durs) {
  const h = find(ts)
  if (h) rows[h.name].d[name] = (rows[h.name].d[name] ?? 0) + dur
}

const p = (s, n) => String(s).padStart(n)
console.log('hold'.padEnd(20), p('pres', 6), p('drop', 6), p('drop%', 7), p('missing', 8), p('checker', 8), p('hiLat', 6), p('fps', 6))
for (const h of holds) {
  const r = rows[h.name]
  const secs = (h.to - h.from) / 1e6
  const tot = r.all + r.dropped
  console.log(
    h.name.padEnd(20),
    p(r.all, 6),
    p(r.dropped, 6),
    p(`${((r.dropped / (tot || 1)) * 100).toFixed(1)}%`, 7),
    p(r.missing, 8),
    p(r.checker, 8),
    p(r.hiLat, 6),
    p((r.all / secs).toFixed(1), 6),
  )
}

const keys = ['GPUTask', 'RasterTask', 'Paint', 'UpdateLayer', 'Commit']
console.log('\nms of each, per hold')
console.log('hold'.padEnd(20), keys.map((k) => p(k, 12)).join(''))
for (const h of holds)
  console.log(h.name.padEnd(20), keys.map((k) => p(((rows[h.name].d[k] ?? 0) / 1000).toFixed(0), 12)).join(''))
