import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

/** `config` reads the environment once at import, so each case gets its own
 *  root and its own module graph. */
async function fresh(root: string) {
  vi.resetModules()
  vi.stubEnv('TRANSOM_ROOT', root)
  return await import('./synth.ts')
}

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'transom-synth-'))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

const inbox = () => join(root, 'inbox', 'debug')

async function sidecars() {
  const names = (await readdir(inbox())).filter((f) => f.endsWith('.transom.json'))
  return Promise.all(
    names.sort().map(async (f) => JSON.parse(await readFile(join(inbox(), f), 'utf8'))),
  )
}

describe('a synthetic group', () => {
  it('lands one take per picture, all naming one group', async () => {
    const synth = await fresh(root)
    const made = await synth.synthGroup(3)
    expect(made).toHaveLength(3)
    const held = await sidecars()
    expect(held).toHaveLength(3)
    expect(new Set(held.map((s) => s.group)).size).toBe(1)
    expect(held.every((s) => s.of === 3)).toBe(true)
  })

  it('asks a question on every take, with chips and a comment box', async () => {
    const synth = await fresh(root)
    await synth.synthGroup(2)
    for (const stamp of await sidecars()) {
      expect(stamp.question).toBeTruthy()
      expect(stamp.choices).toContain('no change')
      expect(stamp.why).toBeTruthy()
    }
  })

  it('offers a way out pointed at the file that was actually written', async () => {
    const synth = await fresh(root)
    const [dest] = await synth.synthGroup(1)
    const [stamp] = await sidecars()
    // The app's file is the artifact, whose name is a UUID picked at the write:
    // a sidecar composed before it would point at nothing.
    expect(stamp.apps[0].path).toBe(dest)
    expect(stamp.links[0].url).toMatch(/^https:/)
  })

  it('writes the sidecar before the image, which is what the watcher waits on', async () => {
    const synth = await fresh(root)
    await synth.synthGroup(1)
    const names = await readdir(inbox())
    const image = names.find((f) => f.endsWith('.png'))!
    const { mtimeMs: sidecarAt } = await import('node:fs/promises').then((fs) =>
      fs.stat(join(inbox(), `${image}.transom.json`)),
    )
    const { mtimeMs: imageAt } = await import('node:fs/promises').then((fs) =>
      fs.stat(join(inbox(), image)),
    )
    expect(sidecarAt).toBeLessThanOrEqual(imageAt)
  })

  it('gives every take a TTL, so a session of them clears itself', async () => {
    const synth = await fresh(root)
    await synth.synthGroup(2)
    for (const name of await readdir(inbox())) expect(name).toContain('.ttl')
  })
})

describe('a synthetic reply', () => {
  it('lands already answered, which is the one state clicking cannot reach', async () => {
    const synth = await fresh(root)
    await synth.synthAnswered()
    const [stamp] = await sidecars()
    expect(stamp.closed).toBe('answered')
    expect(stamp.choice).toBe('better')
    expect(stamp.reply).toBeTruthy()
    expect(Date.parse(stamp.closedAt)).not.toBeNaN()
  })
})

describe('the card it draws', () => {
  it('fits a long label inside the picture and still fills it with a short one', async () => {
    const { card } = await fresh(root)
    const big = await sharp(await card('7', 10, 700, 700)).metadata()
    expect([big.width, big.height]).toEqual([700, 700])
    // A label that would overflow at the simulator's own size comes back
    // smaller rather than clipped, which a rendered width cannot show — so the
    // check is that both render at all and at the size asked for.
    const long = await sharp(await card('take 12/12', 10, 720, 480)).metadata()
    expect([long.width, long.height]).toEqual([720, 480])
  })
})
