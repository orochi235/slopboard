import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { WallItem } from '@shared/protocol.ts'

/** The store holds its entries in module state and `config` reads the
 *  environment at import, so each test needs the root set and the module
 *  graph dropped before it loads either. */
async function freshStore(root: string) {
  process.env.SLOP_ROOT = root
  vi.resetModules()
  return await import('./store.ts')
}

const itemAt = (path: string, over: Partial<WallItem> = {}): WallItem => ({
  id: 'a1',
  url: '/img/a1',
  origUrl: '/orig/a1',
  zone: 'slopboard',
  name: 'a',
  path,
  bornAt: 1000,
  w: 10,
  h: 10,
  ...over,
})

let root: string
let source: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'slop-store-'))
  source = join(root, 'inbox', 'slopboard', 'a.png')
  await mkdir(join(root, 'inbox', 'slopboard'), { recursive: true })
  await writeFile(source, 'png')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('keep', () => {
  it('writes the rescue to the sidecar, where a restart will find it', async () => {
    const store = await freshStore(root)
    store.add({ item: itemAt(source), sourcePath: source, cachePath: join(root, 'a.webp') })

    const keptAt = await store.keep('a1', true)
    expect(typeof keptAt).toBe('number')
    expect(store.snapshot()[0]?.keptAt).toBe(keptAt)
    expect(JSON.parse(await readFile(`${source}.slop.json`, 'utf8')).kept).toBe(
      new Date(keptAt as number).toISOString(),
    )

    await store.keep('a1', false)
    expect(store.snapshot()[0]?.keptAt).toBeUndefined()
    expect(JSON.parse(await readFile(`${source}.slop.json`, 'utf8')).kept).toBeUndefined()
  })

  it('says so rather than throwing when the wall has already forgotten the item', async () => {
    const store = await freshStore(root)
    expect(await store.keep('gone', true)).toBe(false)
  })
})

describe('expireNow and undoExpiry', () => {
  it('moves the file to the trash and brings it back with a fresh life', async () => {
    const store = await freshStore(root)
    store.add({ item: itemAt(source), sourcePath: source, cachePath: join(root, 'a.webp') })

    expect(await store.expireNow('a1')).toBe(true)
    expect(existsSync(source)).toBe(false)
    expect(store.snapshot()).toEqual([])

    const back = await store.undoExpiry()
    expect(existsSync(source)).toBe(true)
    expect(store.snapshot().map((i: WallItem) => i.id)).toEqual(['a1'])
    // Restored at its old bornAt it would be past its TTL already and the
    // sweeper would take it again within the second.
    expect(back?.bornAt).toBeGreaterThan(1000)
  })

  it('holds one undo, and nothing to undo is null rather than an error', async () => {
    const store = await freshStore(root)
    expect(await store.undoExpiry()).toBeNull()

    store.add({ item: itemAt(source), sourcePath: source, cachePath: join(root, 'a.webp') })
    await store.expireNow('a1')
    expect(await store.undoExpiry()).not.toBeNull()
    expect(await store.undoExpiry()).toBeNull()
  })
})
