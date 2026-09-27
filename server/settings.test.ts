import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** `config` reads the environment at import, so each test needs the root set
 *  and the module graph dropped before it loads either. */
async function freshSettings(root: string, ttlEnv?: string) {
  process.env.TRANSOM_ROOT = root
  if (ttlEnv === undefined) delete process.env.TRANSOM_TTL
  else process.env.TRANSOM_TTL = ttlEnv
  vi.resetModules()
  return await import('./settings.ts')
}

let root: string
const file = () => join(root, 'settings.json')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'transom-settings-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
  delete process.env.TRANSOM_TTL
})

describe('the wall lifetime', () => {
  it('falls back to what the environment asked for until one is set', async () => {
    const settings = await freshSettings(root, '4h')
    await settings.load()
    expect(settings.ttlMs()).toBe(14_400_000)
  })

  it('reads the one on disk over the environment, since a person chose it', async () => {
    await writeFile(file(), JSON.stringify({ ttl: '30m' }))
    const settings = await freshSettings(root, '4h')
    await settings.load()
    expect(settings.ttlMs()).toBe(1_800_000)
  })

  it('writes what a person would have typed, and takes effect at once', async () => {
    const settings = await freshSettings(root)
    await settings.load()
    expect(await settings.setTtl(7_200_000)).toBe(7_200_000)
    expect(settings.ttlMs()).toBe(7_200_000)
    expect(JSON.parse(await readFile(file(), 'utf8')).ttl).toBe('2h')
  })

  it('refuses a lifetime outside the bounds rather than emptying the wall', async () => {
    const settings = await freshSettings(root, '4h')
    await settings.load()
    expect(await settings.setTtl(5000)).toBeNull()
    expect(await settings.setTtl(400 * 86_400_000)).toBeNull()
    expect(await settings.setTtl(Number.NaN)).toBeNull()
    expect(settings.ttlMs()).toBe(14_400_000)
  })

  it('ignores a file it cannot read, so a bad edit is not an empty wall', async () => {
    await writeFile(file(), 'not json')
    const settings = await freshSettings(root, '4h')
    await settings.load()
    expect(settings.ttlMs()).toBe(14_400_000)
  })
})
