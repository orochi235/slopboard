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
    expect(back[0]?.bornAt).toBeGreaterThan(1000)
  })

  it('empties as it undoes, and nothing to undo is empty rather than an error', async () => {
    const store = await freshStore(root)
    expect(await store.undoExpiry()).toEqual([])

    store.add({ item: itemAt(source), sourcePath: source, cachePath: join(root, 'a.webp') })
    await store.expireNow('a1')
    expect(await store.undoExpiry()).toHaveLength(1)
    expect(await store.undoExpiry()).toEqual([])
  })

  /** One file per id in the one zone, fresh enough that the sweeper leaves it. */
  const seedFresh = async (store: Awaited<ReturnType<typeof freshStore>>, ids: string[]) => {
    for (const id of ids) {
      const path = join(root, 'inbox', 'slopboard', `${id}.png`)
      await writeFile(path, 'png')
      store.add({
        item: itemAt(path, { id, bornAt: Date.now() }),
        sourcePath: path,
        cachePath: join(root, `${id}.webp`),
      })
    }
  }

  it('walks back through the last ten, newest first', async () => {
    const store = await freshStore(root)
    const ids = Array.from({ length: 11 }, (_, i) => `x${i}`)
    await seedFresh(store, ids)
    for (const id of ids) await store.expireNow(id)

    const undone: string[] = []
    for (;;) {
      const back = await store.undoExpiry()
      if (back.length === 0) break
      undone.push(...back.map((i: WallItem) => i.id))
    }
    expect(undone).toEqual(ids.slice(1).reverse())
  })

  it('never lets a TTL running out take the place of a deliberate expiry', async () => {
    const store = await freshStore(root)
    await seedFresh(store, ['mine'])
    await store.expireNow('mine')

    // Born at 1000 against an eight-hour TTL: the first sweep takes it.
    store.add({ item: itemAt(source), sourcePath: source, cachePath: join(root, 'a.webp') })
    const stop = store.startSweeper()
    try {
      await vi.waitFor(() => expect(existsSync(source)).toBe(false), { timeout: 3000 })
    } finally {
      stop()
    }

    expect((await store.undoExpiry()).map((i: WallItem) => i.id)).toEqual(['mine'])
    expect(await store.undoExpiry()).toEqual([])
  })
})

describe('expireZone', () => {
  /** One file per id, so expiry has something real to move to the trash. */
  const seed = async (
    store: Awaited<ReturnType<typeof freshStore>>,
    of: readonly { id: string; zone: string }[],
  ) => {
    for (const { id, zone } of of) {
      const dir = join(root, 'inbox', zone)
      await mkdir(dir, { recursive: true })
      const path = join(dir, `${id}.png`)
      await writeFile(path, 'png')
      store.add({
        item: itemAt(path, { id, zone }),
        sourcePath: path,
        cachePath: join(root, `${id}.webp`),
      })
    }
  }

  it('takes every artifact in the zone and leaves its neighbours alone', async () => {
    const store = await freshStore(root)
    await seed(store, [
      { id: 'a1', zone: 'alpha' },
      { id: 'a2', zone: 'alpha' },
      { id: 'b1', zone: 'beta' },
    ])
    const gone = await store.expireZone('alpha')
    expect(gone.sort()).toEqual(['a1', 'a2'])
    expect(store.snapshot().map((i: WallItem) => i.id)).toEqual(['b1'])
  })

  it('is one undo step however many it took', async () => {
    const store = await freshStore(root)
    await seed(store, [
      { id: 'a1', zone: 'alpha' },
      { id: 'a2', zone: 'alpha' },
    ])
    await store.expireZone('alpha')
    expect(store.snapshot()).toHaveLength(0)
    const back = await store.undoExpiry()
    expect(back.map((i: WallItem) => i.id).sort()).toEqual(['a1', 'a2'])
    expect(await store.undoExpiry()).toEqual([])
  })

  it('says nothing went when the zone is not there', async () => {
    const store = await freshStore(root)
    expect(await store.expireZone('nowhere')).toEqual([])
  })
})

describe('questions', () => {
  const asking = (over: Partial<WallItem> = {}) =>
    itemAt(source, {
      question: 'which crop?',
      choices: ['left', 'right'],
      attention: { level: 'look', holdMs: null },
      ...over,
    })
  const answerFile = () => join(root, 'answers', 'a.png')
  const sidecar = async () => JSON.parse(await readFile(`${source}.slop.json`, 'utf8'))

  beforeEach(async () => {
    await writeFile(
      `${source}.slop.json`,
      JSON.stringify({ question: 'which crop?', choices: ['left', 'right'], attention: 'look', caption: 'a' }),
    )
  })

  it('writes the answer where the asker waits, and keeps the question on the card with its reply', async () => {
    const store = await freshStore(root)
    store.add({ item: asking(), sourcePath: source, cachePath: join(root, 'a.webp') })

    expect(await store.answer('a1', 'answered', 'left')).toBe(true)
    expect(await readFile(answerFile(), 'utf8')).toBe('answered\nleft')
    const item = store.snapshot()[0]
    expect(item?.question).toBe('which crop?')
    expect(item?.choices).toEqual(['left', 'right'])
    expect(item?.attention).toBeUndefined()
    expect(item?.reply).toMatchObject({ status: 'answered', text: 'left' })
    const disk = await sidecar()
    expect(disk.attention).toBeUndefined()
    expect(disk).toMatchObject({ question: 'which crop?', reply: 'left', closed: 'answered' })
    expect(Date.parse(disk.closedAt)).toBe(item?.reply?.at)
  })

  it('answers once, so a second click cannot overwrite what the asker already read', async () => {
    const store = await freshStore(root)
    store.add({ item: asking(), sourcePath: source, cachePath: join(root, 'a.webp') })
    await store.answer('a1', 'answered', 'left')
    expect(await store.answer('a1', 'answered', 'right')).toBe(false)
    expect(await readFile(answerFile(), 'utf8')).toBe('answered\nleft')
  })

  it('ends the wait as dismissed only when dismissing is meant to close the question', async () => {
    const store = await freshStore(root)
    store.add({ item: asking(), sourcePath: source, cachePath: join(root, 'a.webp') })
    expect(await store.dismiss('a1')).toBe(false)
    expect(existsSync(answerFile())).toBe(false)
    expect(store.snapshot()[0]?.reply).toBeUndefined()
    expect(await store.dismiss('a1', true)).toBe(true)
    expect(await readFile(answerFile(), 'utf8')).toBe('dismissed\n')
    expect(store.snapshot()[0]?.reply?.status).toBe('dismissed')
  })

  it('ends the wait as expired when the card is expired by hand', async () => {
    const store = await freshStore(root)
    store.add({ item: asking(), sourcePath: source, cachePath: join(root, 'a.webp') })
    await store.expireNow('a1')
    expect(await readFile(answerFile(), 'utf8')).toBe('expired\n')
    const [back] = await store.undoExpiry()
    expect(back?.reply?.status).toBe('expired')
  })

  it('is never taken by its TTL while it is still open', async () => {
    const store = await freshStore(root)
    store.add({ item: asking(), sourcePath: source, cachePath: join(root, 'a.webp') })
    const stop = store.startSweeper()
    await new Promise((r) => setTimeout(r, 1200))
    stop()
    expect(existsSync(source)).toBe(true)
  })

  it('lives out a whole TTL from its answer, not from when it was asked', async () => {
    const store = await freshStore(root)
    // Born at 1000, long past an eight-hour TTL: only the answer keeps it.
    store.add({ item: asking(), sourcePath: source, cachePath: join(root, 'a.webp') })
    await store.answer('a1', 'answered', 'left')
    const stop = store.startSweeper()
    await new Promise((r) => setTimeout(r, 1200))
    stop()
    expect(existsSync(source)).toBe(true)
  })
})

describe('the wall lifetime as the panel sets it', () => {
  it('sweeps against the live setting rather than what the daemon started with', async () => {
    process.env.SLOP_TTL = '8h'
    const store = await freshStore(root)
    const settings = await import('./settings.ts')
    await settings.load()
    await settings.setTtl(60_000)
    // Two minutes old against the minute it was just given.
    store.add({
      item: itemAt(source, { bornAt: Date.now() - 120_000 }),
      sourcePath: source,
      cachePath: join(root, 'a.webp'),
    })
    const stop = store.startSweeper()
    try {
      await vi.waitFor(() => expect(existsSync(source)).toBe(false), { timeout: 3000 })
    } finally {
      stop()
      delete process.env.SLOP_TTL
    }
  })
})
