import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Playwright is not a dependency here; the rig borrows whichever copy the
 *  machine already has, and drives a browser out of its cache. */
async function playwright() {
  for (const id of [process.env.FLICKER_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean)) {
    try {
      return await import(id)
    } catch {}
  }
  throw new Error('no playwright: `npm i -g playwright-core`, or set FLICKER_PLAYWRIGHT to a copy')
}

export const W = Number(process.env.FLICKER_W ?? 3008)
export const H = Number(process.env.FLICKER_H ?? 1692)
export const URL = process.env.FLICKER_URL ?? 'http://localhost:5184'
export const OUT = process.env.FLICKER_OUT ?? '.flicker'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Chrome for Testing, not the installed Chrome: driving the user's own browser
 * binary brings their windows forward on macOS for as long as the run lasts.
 */
function chromePath() {
  if (process.env.FLICKER_CHROME) return process.env.FLICKER_CHROME
  const cache = join(process.env.HOME, 'Library/Caches/ms-playwright')
  if (!existsSync(cache)) throw new Error('no ms-playwright cache; set FLICKER_CHROME')
  const build = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))[0]
  if (!build) throw new Error('no chromium build in the cache; set FLICKER_CHROME')
  return join(cache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
}

/** A wall at the real monitor's backing store: 3008x1692 logical, 2x. */
export async function openWall() {
  const { chromium } = await playwright()
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)))
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('canvas')
  await sleep(6000)
  return { browser, page }
}

export const lightboxKind = (page) =>
  page.evaluate(() => {
    const lb = document.querySelector('.lightbox')
    return !lb ? 'none' : lb.querySelector('iframe.lightbox__page') ? 'page' : 'image'
  })

/**
 * Walks a grid of clicks until a page artifact opens. There is no deep link
 * into a card, and the only alternative — an arrival flagged loud enough to
 * open itself — makes the daemon play a sound and post a notification on every
 * run.
 */
export async function openPageLightbox(page) {
  for (let gy = 1; gy <= 4; gy++)
    for (let gx = 1; gx <= 6; gx++) {
      const x = Math.round((gx / 7) * W)
      const y = Math.round((gy / 5) * H)
      // One click spends one rung, so a card needs wall -> zone -> card.
      for (let n = 0; n < 2; n++) {
        await page.mouse.click(x, y)
        await sleep(600)
        const k = await lightboxKind(page)
        if (k === 'page') return true
        if (k === 'image') {
          await page.keyboard.press('Escape')
          await sleep(300)
        }
      }
      await page.keyboard.press('Escape')
      await sleep(150)
      await page.keyboard.press('Escape')
      await sleep(150)
    }
  return false
}
