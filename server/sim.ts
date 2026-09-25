import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { config } from './config.ts'
import { card } from './synth.ts'

function arg(name: string, fallback: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const rate = Number(arg('rate', '60')) // arrivals per hour
const total = Number(arg('count', '0')) // 0 = unbounded
const zones = arg('zones', 'sim').split(',')
// Synthetic cards say so in their names, so a long-lived wall is not buried
// under them. Override with --ttl to test decay at the wall's real rate.
const ttl = arg('ttl', '60')
const ASPECTS = [1, 1, 16 / 9, 9 / 16, 4 / 3, 3 / 4, 21 / 9, 2 / 3]

/** Writes in chunks on purpose: a single atomic write would never exercise the
 *  daemon's awaitWriteFinish guard, which is the thing most likely to regress. */
async function slowWrite(path: string, buf: Buffer) {
  const stream = createWriteStream(path)
  const chunk = Math.ceil(buf.length / 4)
  for (let i = 0; i < buf.length; i += chunk) {
    stream.write(buf.subarray(i, i + chunk))
    await sleep(20)
  }
  await new Promise<void>((r) => stream.end(r))
}

const gapMs = 3_600_000 / rate
console.log(`[sim] ${rate}/hour (one every ${(gapMs / 1000).toFixed(1)}s) → zones ${zones.join(', ')}`)

for (let n = 1; total === 0 || n <= total; n++) {
  const zone = zones[Math.floor(Math.random() * zones.length)]
  const dir = join(config.inbox, zone)
  await mkdir(dir, { recursive: true })

  const aspect = ASPECTS[Math.floor(Math.random() * ASPECTS.length)]
  const w = Math.round(700 * Math.max(1, aspect))
  const h = Math.round(700 * Math.max(1, 1 / aspect))
  const buf = await card(String(n), Math.floor(Math.random() * 360), w, h)
  await slowWrite(join(dir, `${randomUUID()}.ttl${ttl}.png`), buf)

  console.log(`[sim] ${total ? `${n}/${total}` : n} → ${zone} ${w}x${h}`)
  await sleep(gapMs)
}
