/**
 * Six ten-second holds against a running wall, each isolating one suspect in
 * the lightbox flicker, with a Chrome trace sliced by hold. Prints presented
 * and dropped frame counts per hold.
 *
 * Wants a wall of its own, so the run neither disturbs the real one nor waits
 * on it. In three terminals:
 *
 *   SLOP_ROOT=/tmp/slop-flicker SLOP_PORT=8799 npx tsx server/index.ts
 *   SLOP_PORT=8799 SLOP_CLIENT_PORT=5184 npx vite
 *   SLOP_ROOT=/tmp/slop-flicker npx tsx server/sim.ts --rate=3600 --zones=onto,astv --ttl=300
 *
 * Seed `/tmp/slop-flicker/inbox` first — some images, and at least one `.html`
 * in a zone of its own, or there is no page to open.
 *
 * The trace buffer can fill before the run ends, which costs the last hold its
 * frames — a zero row is that, not a wall that stopped drawing. Shorten
 * FLICKER_HOLD if it happens to a hold you care about.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { OUT, openWall, openPageLightbox, lightboxKind, sleep } from './flicker-wall.mjs'

const HOLD = Number(process.env.FLICKER_HOLD ?? 10000)
mkdirSync(OUT, { recursive: true })

const { browser, page } = await openWall()
console.log('wall up')

const client = await page.context().newCDPSession(page)
// Filtered as it arrives: a full trace of this run is ~3.7M events, past what
// one JSON.stringify can hold.
const frames = []
const marks = []
const durs = []
const TIMED = new Set(['GPUTask', 'RasterTask', 'Paint', 'UpdateLayer', 'Commit'])
client.on('Tracing.dataCollected', (d) => {
  for (const e of d.value) {
    if (e.name === 'PipelineReporter' && e.ph === 'b' && e.args?.frame_reporter) {
      const f = e.args.frame_reporter
      frames.push([
        e.ts,
        f.state,
        f.has_missing_content ? 1 : 0,
        f.checkerboarded_needs_raster || f.checkerboarded_needs_record ? 1 : 0,
        f.has_high_latency ? 1 : 0,
      ])
    } else if (typeof e.name === 'string' && e.name.startsWith('COND_')) {
      marks.push([e.ts, e.name])
    } else if (e.dur && TIMED.has(e.name)) {
      durs.push([e.ts, e.name, e.dur])
    }
  }
})
await client.send('Tracing.start', {
  traceConfig: {
    recordMode: 'recordAsMuchAsPossible',
    includedCategories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'blink.user_timing',
      'benchmark',
      'viz',
      'cc',
    ],
  },
})

let n = 0
async function hold(name, setup) {
  await setup()
  await sleep(1200)
  await page.evaluate((s) => performance.mark(`COND_START_${s}`), name)
  await sleep(HOLD)
  await page.evaluate((s) => performance.mark(`COND_END_${s}`), name)
  console.log(`${++n}/6 ${name} (lightbox=${await lightboxKind(page)})`)
}

const css = (content) => () => page.addStyleTag({ content })
const SCRIM = '.lightbox{background:color-mix(in srgb, var(--scrim) 86%, transparent) !important}'

await hold('A_closed', async () => {})
await hold('B_open', async () => {
  if (!(await openPageLightbox(page))) throw new Error('no page artifact on this wall')
})
await hold('C_open_noblur', css('.topbar,.sidebar{backdrop-filter:none !important}'))
await hold('D_open_opaque_scrim', css('.topbar,.sidebar{backdrop-filter:blur(6px) !important} .lightbox{background:#000 !important}'))
await hold('E_open_noiframe', css(`${SCRIM} iframe.lightbox__page{display:none !important}`))
await hold('F_closed_again', async () => {
  await page.addStyleTag({ content: 'iframe.lightbox__page{display:block !important}' })
  await page.keyboard.press('Escape')
  await sleep(500)
})

await client.send('Tracing.end')
await new Promise((r) => client.once('Tracing.tracingComplete', r))
writeFileSync(`${OUT}/frames.json`, JSON.stringify({ frames, marks, durs }))
console.log(`frames=${frames.length} → ${OUT}/frames.json (read it with tools/flicker-report.mjs)`)
await browser.close()
