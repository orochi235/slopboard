/**
 * Measures the symptom rather than a suspect: captures every frame the
 * compositor presents and reports how much each differs from the one before
 * it. A window that flickers moves globally, so it shows up as a step in the
 * whole-frame mean, not as a change in one corner.
 *
 * Same wall setup as tools/flicker-matrix.mjs.
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'
import { OUT, openWall, openPageLightbox, sleep } from './flicker-wall.mjs'

const SECONDS = Number(process.env.FLICKER_SECONDS ?? 12)
mkdirSync(OUT, { recursive: true })

const { browser, page } = await openWall()
const client = await page.context().newCDPSession(page)

async function record(label) {
  const shots = []
  const onFrame = (f) => {
    shots.push({ t: f.metadata.timestamp, buf: Buffer.from(f.data, 'base64') })
    client.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  }
  client.on('Page.screencastFrame', onFrame)
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 480, maxHeight: 270, everyNthFrame: 1 })
  await sleep(SECONDS * 1000)
  await client.send('Page.stopScreencast')
  client.off('Page.screencastFrame', onFrame)

  const grids = []
  for (const s of shots) {
    const px = await sharp(s.buf).greyscale().resize(64, 36, { fit: 'fill' }).raw().toBuffer()
    grids.push(px)
  }
  const diffs = []
  for (let i = 1; i < grids.length; i++) {
    let abs = 0
    let signed = 0
    for (let j = 0; j < grids[i].length; j++) {
      abs += Math.abs(grids[i][j] - grids[i - 1][j])
      signed += grids[i][j] - grids[i - 1][j]
    }
    diffs.push({ i, mad: abs / grids[i].length, shift: signed / grids[i].length })
  }
  const mads = diffs.map((d) => d.mad).sort((a, b) => a - b)
  const q = (f) => (mads.length ? mads[Math.floor(f * (mads.length - 1))].toFixed(2) : 'n/a')
  console.log(`${label}: ${shots.length} frames in ${SECONDS}s (${(shots.length / SECONDS).toFixed(1)}/s)`)
  console.log(`  frame-to-frame mean abs diff  p50=${q(0.5)}  p95=${q(0.95)}  max=${q(1)}`)
  const worst = [...diffs].sort((a, b) => b.mad - a.mad).slice(0, 6)
  for (const d of worst) console.log(`    frame ${d.i}: mad=${d.mad.toFixed(2)} meanShift=${d.shift.toFixed(2)}`)
  if (worst[0]) {
    writeFileSync(`${OUT}/${label}-worst-before.jpg`, shots[worst[0].i - 1].buf)
    writeFileSync(`${OUT}/${label}-worst-after.jpg`, shots[worst[0].i].buf)
  }
}

await record('closed')
if (!(await openPageLightbox(page))) throw new Error('no page artifact on this wall')
await record('open')

await browser.close()
