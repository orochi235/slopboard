import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { config } from './config.ts'
import { frameArgv, frameOf, posterFor } from './poster.ts'
import { durationFrom, durationOf } from './probe.ts'

const run = promisify(execFile)

describe('frameArgv', () => {
  it('seeks before the input, so the skip is not decoded', () => {
    const argv = frameArgv('/in.mp4', '/out.png', 1000)
    expect(argv.indexOf('-ss')).toBeLessThan(argv.indexOf('-i'))
    expect(argv[argv.indexOf('-ss') + 1]).toBe('1.000')
  })

  it('takes one frame and overwrites, since the cache path is reused', () => {
    const argv = frameArgv('/in.mp4', '/out.png', 0)
    expect(argv).toContain('-y')
    expect(argv[argv.indexOf('-frames:v') + 1]).toBe('1')
  })
})

describe('posterFor', () => {
  const never = async () => {
    throw new Error('should not run')
  }

  it('hands back a picture unchanged — it is its own poster', async () => {
    expect(await posterFor('image', '/a.png', '/out.png', { shoot: never, frame: never })).toBe(
      '/a.png',
    )
  })

  it('shoots a page and frames a video, each with its own runner', async () => {
    const seen: string[] = []
    const yes = (tag: string) => async () => {
      seen.push(tag)
      return true
    }
    expect(
      await posterFor('page', '/a.html', '/out.png', { shoot: yes('shoot'), frame: never }),
    ).toBe('/out.png')
    expect(
      await posterFor('video', '/a.mp4', '/out.png', { shoot: never, frame: yes('frame') }),
    ).toBe('/out.png')
    expect(seen).toEqual(['shoot', 'frame'])
  })

  it('declines when the runner produced nothing, so ingest drops the artifact', async () => {
    const no = async () => false
    expect(await posterFor('video', '/a.mp4', '/out.png', { frame: no })).toBeNull()
    expect(await posterFor('page', '/a.html', '/out.png', { shoot: no })).toBeNull()
  })
})

describe('durationFrom', () => {
  it('reads the container seconds as ms', () => {
    expect(durationFrom('{"format":{"duration":"12.480000"}}')).toBe(12_480)
  })

  it('is null for a container that declares none, which is ordinary', () => {
    expect(durationFrom('{"format":{}}')).toBeNull()
    expect(durationFrom('{"format":{"duration":"N/A"}}')).toBeNull()
    expect(durationFrom('{"format":{"duration":"0"}}')).toBeNull()
    expect(durationFrom('not json')).toBeNull()
  })
})

/** The two that actually spawn ffmpeg, against a clip generated here. Skipped
 *  where ffmpeg is absent, so the suite still runs on a machine without it. */
const hasFfmpeg = await run(config.ffmpeg, ['-version'])
  .then(() => true)
  .catch(() => false)

describe.skipIf(!hasFfmpeg)('against a real clip', () => {
  let dir = ''
  let clip = ''

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'transom-poster-test-'))
    clip = join(dir, 'clip.mp4')
    // Three seconds of color bars at a size nothing else on the wall uses,
    // so a poster measured off the source is obvious if it goes wrong.
    await run(config.ffmpeg, [
      '-v', 'error',
      '-f', 'lavfi',
      '-i', 'testsrc=size=322x242:rate=10:duration=3',
      '-pix_fmt', 'yuv420p',
      '-y', clip,
    ])
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes a poster at the video’s own size', async () => {
    const out = join(dir, 'poster.png')
    expect(await frameOf(clip, out)).toBe(true)
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height]).toEqual([322, 242])
  })

  it('falls back to frame 0 for a video shorter than the seek', async () => {
    const short = join(dir, 'short.mp4')
    await run(config.ffmpeg, [
      '-v', 'error',
      '-f', 'lavfi',
      '-i', 'testsrc=size=64x64:rate=10:duration=0.3',
      '-pix_fmt', 'yuv420p',
      '-y', short,
    ])
    const out = join(dir, 'short.png')
    expect(config.posterAtMs).toBeGreaterThan(300)
    expect(await frameOf(short, out)).toBe(true)
  })

  it('reads the runtime', async () => {
    const ms = await durationOf(clip)
    expect(ms).not.toBeNull()
    expect(ms!).toBeGreaterThan(2500)
    expect(ms!).toBeLessThan(3500)
  })

  // Named `.mp4` and not one. ffmpeg identifies by content rather than by
  // extension, so this is what a truncated or mis-sent file actually looks
  // like to it — and a picture named `.mp4` would decode fine.
  it('is false for a file it cannot decode, rather than throwing', async () => {
    const junk = join(dir, 'junk.mp4')
    await writeFile(junk, randomBytes(4096))
    expect(await frameOf(junk, join(dir, 'nope.png'))).toBe(false)
  })

  it('has no runtime for one either', async () => {
    expect(await durationOf(join(dir, 'junk.mp4'))).toBeNull()
  })
})
